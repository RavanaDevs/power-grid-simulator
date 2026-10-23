import type { Asset, Notice, State } from "../game/engine";
import { RELAYS } from "../game/protection";

type MapFeatureKind = Asset["kind"] | "substation";
export type MapFeatureVisibility = {
  zoom: number;
  kind: MapFeatureKind;
  capacityMW?: number;
  simulationId?: string;
  selected?: boolean;
  alarm?: boolean;
};

/** Geography remains visible; this controls individual equipment symbols/labels. */
export function isMapFeatureVisible(feature: MapFeatureVisibility): boolean {
  if (feature.selected || feature.alarm) return true;
  const zoom = Number.isFinite(feature.zoom) ? feature.zoom : 0;
  if (feature.kind === "bus" || feature.kind === "load") return zoom >= 10;
  if (feature.kind === "substation" || feature.kind === "battery")
    return zoom >= 9;
  if (zoom >= 8) return true;
  const fictional = ["G3", "G9", "B1"].includes(feature.simulationId ?? "");
  return (
    !fictional &&
    ((feature.capacityMW ?? 0) >= 100 ||
      /^G\d+$/.test(feature.simulationId ?? ""))
  );
}

export type MapCueKind =
  "trip" | "shedding" | "blackout" | "frequency" | "overload";
type MapCueContent = {
  kind: MapCueKind;
  level: Notice["level"];
  label: string;
  labelSi: string;
  /** Engine IDs, e.g. G4/L1/S2. Resolve geographic marker IDs in the view. */
  targetIds: string[];
};
export type MapEventCue = MapCueContent & {
  id: number;
  detail: string;
  detailSi: string;
  /** Time first received in the browser, never accelerated simulation time. */
  observedAtMs: number;
};
export type MapCueTimeline = {
  lastEventId: number | null;
  cues: MapEventCue[];
};
export type MapAlarm = MapCueContent & { id: string };
export const MAP_CUE_TTL_MS = 9000;

function frequencyTargets(state: State): string[] {
  return state.assets
    .filter((asset) => {
      const hz = state.busFrequency[asset.bus];
      return (
        asset.kind === "bus" &&
        hz > 0 &&
        (hz < RELAYS.frequencyWarningLow || hz > RELAYS.frequencyWarningHigh)
      );
    })
    .map((asset) => asset.id);
}

/**
 * Historical notices do not contain event codes. Keep the few legacy text
 * classifications here; do not infer an old notice's cause from today's state.
 * Current persistent status is derived independently by getMapAlarms.
 */
export function noticeToMapCue(
  event: Notice,
  state: State,
  observedAtMs: number,
): MapEventCue | null {
  const targets = event.asset ? [event.asset] : [];
  let content: MapCueContent | null = null;
  if (
    state.outcome === "blackout" &&
    event.level === "critical" &&
    event.text === state.failureCause
  ) {
    content = {
      kind: "blackout",
      level: "critical",
      label: "Grid blackout",
      labelSi: "ජාල විදුලි බිඳවැටීම",
      targetIds: state.assets
        .filter((asset) => asset.kind === "bus")
        .map((asset) => asset.id),
    };
  } else if (event.level === "critical" && event.text.includes(" tripped:")) {
    const line = state.lines.some((item) => item.id === event.asset);
    content = {
      kind: "trip",
      level: "critical",
      label: line
        ? "Line protection operated"
        : "Generator protection operated",
      labelSi: line
        ? "රැහැන් ආරක්ෂණය ක්‍රියාත්මක විය"
        : "ජනක ආරක්ෂණය ක්‍රියාත්මක විය",
      targetIds: targets,
    };
  } else if (
    event.level === "critical" &&
    event.text.startsWith("Automatic underfrequency load shedding:")
  ) {
    // Notices retain only the island's seed bus, not historical membership.
    // Include currently auto-shed loads as context; keep the original seed even
    // if the island has since split, reconnected, or restored its demand.
    const loads = state.assets.filter(
      (asset) => asset.kind === "load" && (asset.autoShed ?? 0) > 0,
    );
    content = {
      kind: "shedding",
      level: "critical",
      label: "Automatic load shedding",
      labelSi: "ස්වයංක්‍රීය භාර අඩු කිරීම",
      targetIds: [...new Set([...targets, ...loads.map((asset) => asset.id)])],
    };
  } else if (
    event.level === "info" &&
    state.assets.some(
      (asset) => asset.id === event.asset && asset.kind === "load",
    ) &&
    /: demand (curtailed|restored)\.$/.test(event.text)
  ) {
    const restored = event.text.endsWith(": demand restored.");
    content = {
      kind: "shedding",
      level: "info",
      label: restored ? "Load restored" : "Demand curtailed",
      labelSi: restored ? "භාරය යළි සපයා ඇත" : "ඉල්ලුම සීමා කර ඇත",
      targetIds: targets,
    };
  } else if (event.level === "warning" && event.text.startsWith("Frequency ")) {
    content = {
      kind: "frequency",
      level: "warning",
      label: "Frequency outside normal band",
      labelSi: "සංඛ්‍යාතය සාමාන්‍ය පරාසයෙන් පිටතයි",
      targetIds: targets.length ? targets : frequencyTargets(state),
    };
  } else if (
    event.level === "warning" &&
    event.asset &&
    state.lines.some((item) => item.id === event.asset) &&
    /% loading\.$/.test(event.text)
  ) {
    content = {
      kind: "overload",
      level: "warning",
      label: "High corridor loading",
      labelSi: "මාර්ගයේ භාරය ඉහළයි",
      targetIds: targets,
    };
  }
  return content
    ? {
        ...content,
        id: event.id,
        detail: event.text,
        detailSi: event.textSi,
        observedAtMs,
      }
    : null;
}

/**
 * Call on incoming snapshots and on a wall-clock animation tick. The initial
 * snapshot establishes a watermark, so saved history never animates as new.
 * Pass reset:true for an explicit save restore or scenario replacement; a
 * decreasing event ID also detects the common scenario-reset case.
 */
export function updateMapCueTimeline(
  previous: MapCueTimeline,
  state: State,
  nowMs: number,
  options: { reset?: boolean; ttlMs?: number; maxCues?: number } = {},
): MapCueTimeline {
  if (!Number.isFinite(nowMs)) return previous;
  const newest = state.events.reduce(
    (max, event) => Math.max(max, event.id),
    0,
  );
  if (
    options.reset ||
    previous.lastEventId === null ||
    newest < previous.lastEventId
  )
    return { lastEventId: newest, cues: [] };
  const ttl = Math.max(0, options.ttlMs ?? MAP_CUE_TTL_MS);
  const maxCues = Math.max(0, Math.floor(options.maxCues ?? 8));
  const fresh = state.events
    .filter((event) => event.id > previous.lastEventId!)
    .sort((a, b) => b.id - a.id)
    .map((event) => noticeToMapCue(event, state, nowMs))
    .filter((cue): cue is MapEventCue => cue !== null);
  const cues = [...fresh, ...previous.cues]
    .filter((cue) => nowMs - cue.observedAtMs < ttl)
    .slice(0, maxCues);
  return { lastEventId: newest, cues };
}

/** Persistent alarms follow actual model state, not retained notification text. */
export function getMapAlarms(state: State): MapAlarm[] {
  const alarms: MapAlarm[] = [];
  if (state.outcome === "blackout")
    alarms.push({
      id: "system:blackout",
      kind: "blackout",
      level: "critical",
      label: "Grid blackout",
      labelSi: "ජාල විදුලි බිඳවැටීම",
      targetIds: state.assets
        .filter((asset) => asset.kind === "bus")
        .map((asset) => asset.id),
    });
  for (const line of state.lines) {
    if (!line.online && line.tripReason)
      alarms.push({
        id: `trip:${line.id}`,
        kind: "trip",
        level: "critical",
        label: "Tripped corridor",
        labelSi: "ආරක්ෂණයෙන් විසන්ධි වූ මාර්ගය",
        targetIds: [line.id],
      });
    else if (
      line.online &&
      line.capacity > 0 &&
      Math.abs(line.flow) / line.capacity >= 0.9
    )
      alarms.push({
        id: `loading:${line.id}`,
        kind: "overload",
        level: Math.abs(line.flow) > line.capacity ? "critical" : "warning",
        label: "High corridor loading",
        labelSi: "මාර්ගයේ භාරය ඉහළයි",
        targetIds: [line.id],
      });
  }
  for (const asset of state.assets) {
    if (
      !["bus", "load"].includes(asset.kind) &&
      !asset.online &&
      asset.tripReason
    )
      alarms.push({
        id: `trip:${asset.id}`,
        kind: "trip",
        level: "critical",
        label: "Tripped generator",
        labelSi: "ආරක්ෂණයෙන් විසන්ධි වූ ජනකය",
        targetIds: [asset.id],
      });
    if (asset.kind === "load" && ((asset.autoShed ?? 0) > 0 || asset.shed)) {
      const automatic = (asset.autoShed ?? 0) > 0;
      alarms.push({
        id: `shedding:${asset.id}`,
        kind: "shedding",
        level: automatic ? "warning" : "info",
        label: automatic ? "Automatic shedding active" : "Demand curtailed",
        labelSi: automatic
          ? "ස්වයංක්‍රීය භාර අඩු කිරීම ක්‍රියාත්මකයි"
          : "ඉල්ලුම සීමා කර ඇත",
        targetIds: [asset.id],
      });
    }
  }
  for (const id of frequencyTargets(state))
    alarms.push({
      id: `frequency:${id}`,
      kind: "frequency",
      level: "warning",
      label: "Frequency outside normal band",
      labelSi: "සංඛ්‍යාතය සාමාන්‍ය පරාසයෙන් පිටතයි",
      targetIds: [id],
    });
  return alarms;
}
