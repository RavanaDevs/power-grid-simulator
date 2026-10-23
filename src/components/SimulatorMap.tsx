"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { State } from "@/game/engine";
import type {
  InfrastructureSite,
  TransmissionRoute,
} from "@/simulator/infrastructure";
import {
  BUS_COORDS,
  MODEL_COORDS,
  buildModelConnections,
  MODEL_SWITCHYARDS,
} from "@/simulator/modelTopology";
import {
  getMapAlarms,
  isMapFeatureVisible,
  updateMapCueTimeline,
  type MapCueTimeline,
  type MapEventCue,
} from "@/simulator/mapPresentation";
import boundary from "@/game/data/sri-lanka.json";

type Props = {
  state: State;
  sessionKey: number;
  sites: InfrastructureSite[];
  routes: TransmissionRoute[];
  selectedId: string;
  onSelect: (id: string) => void;
  onLocateModel: (id: string) => void;
  focusId: string | null;
  focusRequest: number;
  layer: "operations" | "infrastructure";
  showLabels: boolean;
  language: "en" | "si";
};
type MarkerRecord = {
  marker: Leaflet.Marker;
  name: string;
  kind: InfrastructureSite["kind"] | "load" | "bus" | "battery";
  simulationId?: string;
  capacityMW?: number;
  yardFor?: string;
  signature?: string;
  visible: boolean;
  alarm: boolean;
  contextualHidden?: boolean;
  labelSize?: [number, number];
};
type LineRecord = {
  line: Leaflet.Polyline;
  hit: Leaflet.Polyline;
  badge?: Leaflet.Marker;
  modelId?: string;
  assetId?: string;
  selectionId: string;
  viaSiteId?: string;
  voltage: number;
  approximate: boolean;
  signature?: string;
  badgeText?: string;
};
type MapRuntime = {
  L: typeof Leaflet;
  map: Leaflet.Map;
  tiles: Leaflet.TileLayer;
  features: Leaflet.LayerGroup;
  markers: Map<string, MarkerRecord>;
  lines: Map<string, LineRecord>;
  frame: number;
  moving: boolean;
  scheduleLayout: () => void;
};
const SRI_LANKA_BOUNDS: [[number, number], [number, number]] = [
  [5.8, 79.45],
  [9.9, 81.95],
];
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const KIND_COLOR: Record<MarkerRecord["kind"], string> = {
  coal: "#475569",
  oil: "#b77922",
  hydro: "#1682bf",
  wind: "#147b62",
  solar: "#b98917",
  substation: "#9255bb",
  bus: "#607d8b",
  load: "#506b89",
  battery: "#3e8b70",
};
const GLYPHS: Record<MarkerRecord["kind"], string> = {
  coal: '<path d="M9 22v-8h4v8m2 0V10h4v12m2 0V6h3v16M7 24h18"/>',
  oil: '<path d="M16 7c-1 5-7 7-7 12a7 7 0 0014 0c0-4-3-7-4-9-1 3-3 4-3 4z"/>',
  hydro:
    '<path d="M16 6c-3 5-8 10-8 14a8 8 0 0016 0c0-4-5-9-8-14zM11 21c2 3 5 4 8 2"/>',
  wind: '<path d="M16 16v11m0-13V5m-2 11-8 5m12-5 8 5"/><circle cx="16" cy="15" r="2"/>',
  solar:
    '<path d="M8 12h16l3 12H5zM10 18h14M12 12l-1 12m9-12 1 12M16 5v3m-7-2 2 2m12-2-2 2"/>',
  substation:
    '<circle cx="13" cy="16" r="6"/><circle cx="20" cy="16" r="6"/><path d="M4 16h3m19 0h3"/>',
  bus: '<path d="M7 16h18M11 10v12m10-12v12"/>',
  load: '<path d="M7 14 16 7l9 7v11H7zM13 25v-8h6v8"/>',
  battery: '<path d="M7 11h18v14H7zM12 7h8v4M11 18h4m6-2v4m-2-2h4"/>',
};
function iconHTML(
  record: MarkerRecord,
  color: string,
  selected: boolean,
  badge = "",
) {
  const reference = !record.simulationId;
  return `<svg class="sim-map-symbol" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><rect x="1.5" y="1.5" width="29" height="29" rx="${record.kind === "substation" || record.kind === "bus" ? 5 : 15}" fill="${selected ? "#e4f4ff" : "#ffffff"}" stroke="${color}" stroke-width="${selected ? 3 : 1.8}" ${reference ? 'stroke-dasharray="3 2"' : ""}/><g fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(3.2 3.2) scale(.8)">${GLYPHS[record.kind]}</g></svg><span class="sim-map-label${selected ? " sim-map-label--selected" : ""}">${escape(record.name)}</span>${badge ? `<span class="sim-map-equipment-status">${escape(badge)}</span>` : ""}`;
}

/** Run only after camera/detail changes, never on every simulation tick. */
function layoutFeatures(r: MapRuntime, props: Props) {
  const zoom = r.map.getZoom();
  const selectedConnection = [...r.lines.values()].find(
    (line) => line.assetId && line.selectionId === props.selectedId,
  );
  const selectedLine = props.state.lines.find(
    (line) => `model:${line.id}` === props.selectedId,
  );
  const selectedEnds = selectedLine
    ? [`S${selectedLine.from + 1}`, `S${selectedLine.to + 1}`]
    : [];
  for (const [id, record] of r.markers) {
    const selected =
      id === props.selectedId ||
      id === selectedConnection?.viaSiteId ||
      selectedEnds.includes(record.simulationId ?? "");
    const visible =
      (!record.contextualHidden || selected) &&
      isMapFeatureVisible({
        zoom,
        kind: record.kind,
        capacityMW: record.capacityMW,
        simulationId: record.simulationId,
        selected,
        alarm: record.alarm,
      });
    if (visible !== record.visible) {
      record.visible = visible;
      if (visible) record.marker.addTo(r.features);
      else r.features.removeLayer(record.marker);
    }
  }
  const markers = [...r.markers.entries()]
    .filter(([, record]) => record.visible)
    .sort(
      ([a, x], [b, y]) =>
        Number(b === props.selectedId) - Number(a === props.selectedId) ||
        Number(y.alarm) - Number(x.alarm) ||
        (y.capacityMW ?? 0) - (x.capacityMW ?? 0),
    );
  // Batch uncached size reads, then perform writes. Camera positions come from
  // Leaflet projection, so there are no per-marker DOM geometry reads on zoom.
  for (const [, record] of markers) {
    if (!record.labelSize) {
      const label = record.marker
        .getElement()
        ?.querySelector<HTMLElement>(".sim-map-label");
      if (label) record.labelSize = [label.offsetWidth, label.offsetHeight];
    }
  }
  const size = r.map.getSize();
  type Box = { left: number; right: number; top: number; bottom: number };
  const occupied: Box[] = markers.map(([, record]) => {
    const p = r.map.latLngToContainerPoint(record.marker.getLatLng());
    return { left: p.x - 17, right: p.x + 17, top: p.y - 17, bottom: p.y + 17 };
  });
  const overlaps = (box: Box) =>
    occupied.some(
      (a) =>
        box.left < a.right + 3 &&
        box.right > a.left - 3 &&
        box.top < a.bottom + 2 &&
        box.bottom > a.top - 2,
    );
  for (const [id, record] of markers) {
    const label = record.marker
      .getElement()
      ?.querySelector<HTMLElement>(".sim-map-label");
    if (!label || !record.labelSize) continue;
    const [width, height] = record.labelSize;
    const p = r.map.latLngToContainerPoint(record.marker.getLatLng());
    let left = 22;
    let box = {
      left: p.x + left,
      right: p.x + left + width,
      top: p.y - 12,
      bottom: p.y - 12 + height,
    };
    if (overlaps(box) || box.right > size.x - 8) {
      left = -22 - width;
      box = { ...box, left: p.x + left, right: p.x + left + width };
    }
    const outside =
      box.right < 0 || box.left > size.x || box.bottom < 0 || box.top > size.y;
    const visible =
      !outside &&
      (id === props.selectedId || (props.showLabels && !overlaps(box)));
    label.style.left = `${left + 16}px`;
    label.style.visibility = visible ? "visible" : "hidden";
    if (visible) occupied.push(box);
  }
}

export default function SimulatorMap(props: Props) {
  const element = useRef<HTMLDivElement>(null);
  const runtime = useRef<MapRuntime | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const timeline = useRef<MapCueTimeline>({ lastEventId: null, cues: [] });
  const lastSession = useRef(props.sessionKey);
  const [cues, setCues] = useState<MapEventCue[]>([]);
  // A generation also rebuilds overlays after a development hot reload.
  const [ready, setReady] = useState(0);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [zoom, setZoom] = useState(7);
  const si = props.language === "si";
  const operations = props.layer === "operations";

  useEffect(() => {
    const reset = lastSession.current !== props.sessionKey;
    lastSession.current = props.sessionKey;
    timeline.current = updateMapCueTimeline(
      timeline.current,
      props.state,
      Date.now(),
      { reset },
    );
    setCues((previous) =>
      previous.length === timeline.current.cues.length &&
      previous.every((cue, i) => cue === timeline.current.cues[i])
        ? previous
        : timeline.current.cues,
    );
  }, [props.state, props.sessionKey]);
  useEffect(() => {
    if (!cues.length) return;
    const timer = window.setTimeout(() => {
      timeline.current = updateMapCueTimeline(
        timeline.current,
        latest.current.state,
        Date.now(),
      );
      setCues(timeline.current.cues);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cues]);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (disposed || !element.current) return;
        const map = L.map(element.current, {
          center: [7.85, 80.7],
          zoom: 7,
          zoomSnap: 0.5,
          zoomDelta: 1,
          minZoom: 5,
          maxZoom: 18,
          zoomControl: false,
          preferCanvas: false,
          attributionControl: true,
          scrollWheelZoom: true,
          wheelPxPerZoomLevel: 40,
        });
        map.createPane("coastline").style.zIndex = "199";
        L.geoJSON(
          {
            type: "Feature",
            properties: {},
            geometry: boundary.geometry,
          } as GeoJSON.Feature,
          {
            pane: "coastline",
            style: {
              color: "#8da9a2",
              weight: 1,
              fillColor: "#e5eee7",
              fillOpacity: 1,
            },
            interactive: false,
          },
        ).addTo(map);
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
            maxZoom: 19,
            keepBuffer: 2,
            updateWhenIdle: true,
            updateWhenZooming: false,
          },
        ).addTo(map);
        tiles.on("tileerror", () => {
          if (!disposed) setOffline(true);
        });
        map.attributionControl.setPrefix(false);
        L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
        const value: MapRuntime = {
          L,
          map,
          tiles,
          features: L.layerGroup().addTo(map),
          markers: new Map(),
          lines: new Map(),
          frame: 0,
          moving: false,
          scheduleLayout: () => {},
        };
        value.scheduleLayout = () => {
          if (value.frame || value.moving) return;
          value.frame = requestAnimationFrame(() => {
            value.frame = 0;
            if (!disposed && !value.moving)
              layoutFeatures(value, latest.current);
          });
        };
        runtime.current = value;
        map.fitBounds(SRI_LANKA_BOUNDS, { padding: [22, 22] });
        setZoom(map.getZoom());
        map.on("movestart", () => {
          value.moving = true;
          map.getContainer().classList.add("sim-map-moving");
        });
        map.on("moveend", () => {
          value.moving = false;
          map.getContainer().classList.remove("sim-map-moving");
          setZoom(map.getZoom());
          value.scheduleLayout();
        });
        observer = new ResizeObserver(() => {
          map.invalidateSize({ pan: false });
          value.scheduleLayout();
        });
        observer.observe(element.current);
        void document.fonts.ready.then(() => {
          if (disposed) return;
          for (const record of value.markers.values())
            record.labelSize = undefined;
          value.scheduleLayout();
        });
        setReady((generation) => generation + 1);
      })
      .catch(() => {
        if (!disposed) setLoadError(true);
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      if (runtime.current) {
        cancelAnimationFrame(runtime.current.frame);
        runtime.current.map.remove();
      }
      runtime.current = null;
    };
  }, []);

  useEffect(() => {
    const r = runtime.current;
    if (!ready || !r) return;
    r.features.clearLayers();
    r.markers.clear();
    r.lines.clear();
    const addMarker = (
      id: string,
      coord: [number, number],
      name: string,
      kind: MarkerRecord["kind"],
      simulationId?: string,
      capacityMW?: number,
    ) => {
      const record: MarkerRecord = {
        marker: r.L.marker(coord, { title: name, alt: name, keyboard: true }),
        name,
        kind,
        simulationId,
        capacityMW,
        visible: false,
        alarm: false,
        yardFor: Object.entries(MODEL_SWITCHYARDS).find(
          ([, yard]) => yard === id,
        )?.[0],
      };
      record.marker.setIcon(
        r.L.divIcon({
          className: "sim-map-marker",
          html: iconHTML(record, KIND_COLOR[kind], false),
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      );
      record.marker.on("click", () => latest.current.onSelect(id));
      record.contextualHidden =
        props.layer === "operations" && !simulationId && !record.yardFor;
      r.markers.set(id, record);
    };
    const addLine = (
      id: string,
      coordinates: [number, number][],
      name: string,
      voltage: number,
      approximate: boolean,
      modelId?: string,
      assetId?: string,
      selectionId = id,
      viaSiteId?: string,
    ) => {
      const line = r.L.polyline(coordinates, {
        color: voltage >= 220 ? "#7c3aed" : "#0d9488",
        weight: 2.5,
        opacity: 0.85,
        smoothFactor: 1.5,
        interactive: false,
      }).addTo(r.features);
      const hit = r.L.polyline(coordinates, {
        color: "transparent",
        weight: assetId ? 12 : 16,
        opacity: 0,
        smoothFactor: 1.5,
        interactive: true,
      }).addTo(r.features);
      hit.bindTooltip(escape(name), { sticky: true, direction: "top" });
      hit.on("click", () => latest.current.onSelect(selectionId));
      const path = hit.getElement();
      path?.setAttribute("tabindex", "0");
      path?.setAttribute("role", "button");
      path?.setAttribute("aria-label", name);
      path?.addEventListener("keydown", (event) => {
        if (["Enter", " "].includes((event as KeyboardEvent).key)) {
          event.preventDefault();
          latest.current.onSelect(selectionId);
        }
      });
      const badge = modelId
        ? r.L.marker(line.getBounds().getCenter(), {
            interactive: true,
            keyboard: true,
            zIndexOffset: 500,
          }).on("click", () => latest.current.onSelect(selectionId))
        : undefined;
      r.lines.set(id, {
        line,
        hit,
        badge,
        modelId,
        assetId,
        selectionId,
        viaSiteId,
        voltage,
        approximate,
      });
    };
    if (props.layer === "infrastructure") {
      for (const route of props.routes)
        addLine(
          `route:${route.id}`,
          route.coordinates,
          `${route.name} · ${route.voltageKV} kV${route.confidence === "approximate" ? (si ? " · ආසන්න මාර්ගය" : " · indicative route") : ""}`,
          route.voltageKV,
          route.confidence === "approximate",
        );
    } else {
      // Equipment feeders belong to the reduced model. Their bends may reference
      // a mapped switchyard, but they are never presented as surveyed line routes.
      for (const connection of buildModelConnections(
        latest.current.state.assets,
        props.sites,
      )) {
        const asset = latest.current.state.assets.find(
          (item) => item.id === connection.assetId,
        )!;
        addLine(
          connection.id,
          connection.coordinates,
          `${si ? asset.nameSi : asset.name} · ${si ? "ආදර්ශ පෝෂක සම්බන්ධතාව" : "model equipment connection"}`,
          0,
          true,
          undefined,
          connection.assetId,
          connection.selectionId,
          connection.viaSiteId,
        );
      }
      for (const line of latest.current.state.lines)
        addLine(
          `model:${line.id}`,
          [BUS_COORDS[line.from], BUS_COORDS[line.to]],
          `${line.id} · ${si ? "සරල කළ ආදර්ශ සම්බන්ධතාව" : "simplified model corridor"}`,
          0,
          true,
          line.id,
        );
      for (const asset of latest.current.state.assets) {
        if (asset.kind === "bus")
          addMarker(
            `model:${asset.id}`,
            BUS_COORDS[asset.bus],
            `${si ? asset.nameSi : asset.name} · ${si ? "ආදර්ශ බසය" : "equivalent bus"}`,
            "bus",
            asset.id,
          );
        else if (
          asset.kind === "load" ||
          asset.kind === "battery" ||
          ((asset.id === "G3" || asset.id === "G9") &&
            !props.sites.some((site) => site.simulationId === asset.id))
        )
          addMarker(
            `model:${asset.id}`,
            MODEL_COORDS[asset.id] ?? BUS_COORDS[asset.bus],
            `${si ? asset.nameSi : asset.name} · ${si ? "ආදර්ශය" : "model"}`,
            asset.kind,
            asset.id,
            asset.capacity,
          );
      }
    }
    for (const site of props.sites)
      addMarker(
        site.id,
        [site.lat, site.lon],
        si ? site.nameSi : site.name,
        site.kind,
        site.simulationId,
        site.capacityMW,
      );
    r.scheduleLayout();
  }, [ready, props.sites, props.routes, props.layer, props.language]);

  useEffect(() => {
    const r = runtime.current;
    if (!ready || !r) return;
    const assets = new Map(
      props.state.assets.map((asset) => [asset.id, asset]),
    );
    const modelLines = new Map(
      props.state.lines.map((line) => [line.id, line]),
    );
    const alarms = new Set(
      getMapAlarms(props.state)
        .filter((alarm) => alarm.kind !== "blackout")
        .flatMap((alarm) => alarm.targetIds),
    );
    const recent = new Set(cues.flatMap((cue) => cue.targetIds));
    let changedLayout = false;
    r.map
      .getContainer()
      .classList.toggle(
        "sim-map-paused",
        props.state.paused || props.state.finished,
      );
    for (const [id, record] of r.markers) {
      const asset = record.simulationId
        ? assets.get(record.simulationId)
        : undefined;
      const selected = id === props.selectedId;
      const tripped =
        operations && asset && !asset.online && !!asset.tripReason;
      const shed =
        operations && asset?.kind === "load"
          ? Math.max(asset.shed ? 0.3 : 0, asset.autoShed ?? 0)
          : 0;
      const dead =
        operations &&
        asset &&
        (asset.kind === "bus"
          ? props.state.busFrequency[asset.bus] < 1
          : asset.kind === "load"
            ? (asset.served ?? 0) < 0.1
            : !asset.online);
      const warning =
        operations &&
        asset &&
        (asset.starting ||
          shed > 0 ||
          (props.state.busFrequency[asset.bus] > 1 &&
            Math.abs(props.state.busFrequency[asset.bus] - 50) > 0.5));
      const alarm = !!(
        operations &&
        asset &&
        (alarms.has(asset.id) || recent.has(asset.id))
      );
      const color = tripped
        ? "#d3344f"
        : operations && asset
          ? dead
            ? "#8493a2"
            : warning
              ? "#c17b0b"
              : "#058b76"
          : KIND_COLOR[record.kind];
      const badge = tripped
        ? si
          ? "විසන්ධියි"
          : "TRIPPED"
        : shed
          ? `${si ? "අඩු කළ භාරය" : "SHED"} ${Math.round(shed * 100)}%`
          : operations && asset?.kind === "load" && dead
            ? si
              ? "විදුලිය නැත"
              : "NO SUPPLY"
            : operations && asset?.starting
              ? si
                ? "ආරම්භ වෙමින්"
                : "STARTING"
              : "";
      const active =
        operations && record.simulationId && recent.has(record.simulationId);
      const signature = `${selected}:${color}:${badge}:${active}:${props.layer}`;
      if (record.alarm !== alarm) {
        record.alarm = alarm;
        changedLayout = true;
      }
      if (record.signature !== signature) {
        record.marker.setIcon(
          r.L.divIcon({
            className: `sim-map-marker${selected ? " sim-map-marker--selected" : ""}${tripped ? " sim-map-marker--trip" : shed ? " sim-map-marker--shed" : ""}${active ? " sim-map-marker--event" : ""}`,
            html: iconHTML(record, color, selected, badge),
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        );
        record.marker.setZIndexOffset(
          selected ? 1200 : alarm ? 800 : asset ? 200 : 0,
        );
        record.marker
          .getElement()
          ?.setAttribute(
            "aria-label",
            `${record.name}${badge ? ` · ${badge}` : ""}`,
          );
        record.signature = signature;
        changedLayout = true;
      }
    }
    for (const record of r.lines.values()) {
      const selected = record.selectionId === props.selectedId;
      const line = record.modelId ? modelLines.get(record.modelId) : undefined;
      const asset = record.assetId ? assets.get(record.assetId) : undefined;
      const tripped = line
        ? !line.online && !!line.tripReason
        : asset
          ? !asset.online && !!asset.tripReason
          : false;
      const open = line
        ? !line.online
        : asset
          ? asset.kind === "load"
            ? (asset.served ?? 0) < 0.1
            : !asset.online
          : false;
      const utilization = line ? Math.abs(line.flow) / line.capacity : 0;
      const flow =
        line?.flow ??
        (asset?.kind === "load" ? -(asset.served ?? 0) : (asset?.output ?? 0));
      const flowing = operations && !open && Math.abs(flow) > 0.1;
      const danger = tripped || utilization > 1;
      const color = danger
        ? "#d3344f"
        : selected
          ? "#008bd2"
          : open
            ? "#8998a7"
            : line || asset
              ? utilization >= 0.8
                ? "#cb8814"
                : "#168d7d"
              : record.voltage >= 220
                ? "#7c3aed"
                : "#0d9488";
      const active = !!record.modelId && recent.has(record.modelId);
      const signature = `${selected}:${color}:${open}:${flowing}:${flow < 0}:${active}`;
      if (record.signature !== signature) {
        record.line.setStyle({
          color,
          weight: selected ? 4.5 : record.assetId ? 2 : 2.8,
          opacity: open ? 0.72 : record.assetId ? 0.7 : 0.9,
          dashArray: record.approximate
            ? open
              ? "2 9"
              : record.assetId
                ? "3 7"
                : "10 6"
            : undefined,
        });
        const path = record.line.getElement();
        path?.classList.toggle("sim-map-flow", flowing);
        path?.classList.toggle("sim-map-flow-reverse", flow < 0);
        path?.classList.toggle("sim-map-line-trip", tripped);
        path?.classList.toggle("sim-map-line-event", active);
        if (selected) record.line.bringToFront();
        record.signature = signature;
      }
      const badgeText =
        line && (tripped || utilization >= 0.9 || selected)
          ? `${line.id} · ${tripped ? (si ? "විසන්ධියි" : "TRIPPED") : open ? (si ? "විවෘතයි" : "OPEN") : `${Math.round(utilization * 100)}%`}`
          : "";
      if (record.badge && record.badgeText !== `${badgeText}:${danger}`) {
        if (badgeText) {
          record.badge
            .setIcon(
              r.L.divIcon({
                className: `sim-map-line-status${danger ? " is-danger" : ""}`,
                html: `<span>${escape(badgeText)}</span>`,
                iconSize: [0, 0],
              }),
            )
            .addTo(r.features);
          record.badge.getElement()?.setAttribute("aria-label", badgeText);
        } else r.features.removeLayer(record.badge);
        record.badgeText = `${badgeText}:${danger}`;
      }
    }
    if (changedLayout) r.scheduleLayout();
  }, [
    ready,
    props.state,
    props.selectedId,
    props.layer,
    props.sites,
    props.routes,
    props.language,
    cues,
    operations,
    si,
  ]);

  useEffect(() => {
    runtime.current?.scheduleLayout();
  }, [props.selectedId, props.showLabels]);
  useEffect(() => {
    const r = runtime.current;
    if (!ready || !r || !props.focusId) return;
    r.map.invalidateSize({ pan: false });
    if (props.focusId === "country") {
      r.map.fitBounds(SRI_LANKA_BOUNDS, { padding: [22, 22] });
      return;
    }
    const marker = r.markers.get(props.focusId);
    const line = r.lines.get(props.focusId);
    if (marker)
      r.map.flyTo(marker.marker.getLatLng(), Math.max(11, r.map.getZoom()), {
        duration: 0.45,
      });
    else if (line)
      r.map.flyToBounds(line.line.getBounds(), {
        padding: [60, 60],
        maxZoom: 11,
        duration: 0.45,
      });
  }, [ready, props.focusId, props.focusRequest, props.layer]);

  const locateCue = (cue: MapEventCue) => {
    const target = cue.targetIds[0];
    if (target) props.onLocateModel(target);
  };
  const trips =
    props.state.lines.filter((line) => !line.online && line.tripReason).length +
    props.state.assets.filter((asset) => !asset.online && asset.tripReason)
      .length;
  const shedLoads = props.state.assets.filter(
    (asset) =>
      asset.kind === "load" && (asset.shed || (asset.autoShed ?? 0) > 0),
  ).length;
  return (
    <div
      className={`sim-map${operations && props.state.outcome === "blackout" ? " sim-map-blackout" : ""}`}
    >
      <div
        className="sim-map-canvas"
        ref={element}
        role="region"
        aria-label={
          si
            ? "ශ්‍රී ලංකා විදුලිබල සිතියම"
            : "Sri Lanka electricity network map"
        }
      />
      {!ready && (
        <div className="sim-map-loading" role="status">
          {loadError
            ? si
              ? "සිතියම විවෘත කළ නොහැක. පිටුව නැවත පූරණය කරන්න."
              : "Map could not load. Refresh to retry."
            : si
              ? "සිතියම පූරණය වෙමින්…"
              : "Loading geographic map…"}
        </div>
      )}
      <div
        className="sim-map-tools"
        role="group"
        aria-label={si ? "සිතියම් පාලනය" : "Map controls"}
      >
        <button
          type="button"
          title={si ? "විශාල කරන්න" : "Zoom in"}
          aria-label={si ? "විශාල කරන්න" : "Zoom in"}
          onClick={() => runtime.current?.map.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          title={si ? "කුඩා කරන්න" : "Zoom out"}
          aria-label={si ? "කුඩා කරන්න" : "Zoom out"}
          onClick={() => runtime.current?.map.zoomOut()}
        >
          −
        </button>
        <button
          type="button"
          title={si ? "මුළු රටම පෙන්වන්න" : "Fit Sri Lanka"}
          aria-label={si ? "මුළු රටම පෙන්වන්න" : "Fit Sri Lanka"}
          onClick={() =>
            runtime.current?.map.fitBounds(SRI_LANKA_BOUNDS, {
              padding: [22, 22],
            })
          }
        >
          ⌖
        </button>
      </div>
      <div className="sim-map-detail-level">
        {zoom < 8
          ? si
            ? "ප්‍රධාන බලාගාර · විස්තර සඳහා විශාල කරන්න"
            : "Major plants · zoom in for detail"
          : zoom < 9
            ? si
              ? "සියලු බලාගාර"
              : "All plants"
            : zoom < 10
              ? si
                ? "බලාගාර හා උපපොළ"
                : "Plants & substations"
              : si
                ? "සම්පූර්ණ ජාල විස්තර"
                : "Full network detail"}
      </div>
      {operations && (trips > 0 || shedLoads > 0) && (
        <div className="sim-map-incident-summary" role="status">
          {trips > 0 && (
            <span className="is-trip">
              ● {trips} {si ? "ආරක්ෂණ විසන්ධි" : "tripped"}
            </span>
          )}
          {shedLoads > 0 && (
            <span className="is-shed">
              ◐ {shedLoads} {si ? "භාර අඩු කිරීම්" : "loads curtailed"}
            </span>
          )}
          {props.state.unserved > 0.5 && (
            <span>
              {Math.round(props.state.unserved)} MW{" "}
              {si ? "සපයා නැත" : "unserved"}
            </span>
          )}
        </div>
      )}
      {cues.length > 0 && (
        <div
          className="sim-map-events"
          aria-live="polite"
          aria-label={si ? "සජීවී සිදුවීම්" : "Live map events"}
        >
          {cues.slice(0, 3).map((cue) => (
            <button
              type="button"
              key={cue.id}
              className={`sim-map-event sim-map-event--${cue.level}`}
              onClick={() => locateCue(cue)}
              title={si ? cue.detailSi : cue.detail}
            >
              <span className="sim-map-event-icon">
                {cue.kind === "trip" || cue.kind === "blackout" ? "ϟ" : "!"}
              </span>
              <span>
                <strong>{si ? cue.labelSi : cue.label}</strong>
                <small>{si ? cue.detailSi : cue.detail}</small>
                <em>{si ? "සිතියමේ පෙන්වන්න ↗" : "Locate on map ↗"}</em>
              </span>
            </button>
          ))}
        </div>
      )}
      {offline && (
        <div className="sim-map-offline" role="status">
          <span>
            {si
              ? "සිතියම් පසුබිම ලබාගත නොහැක · දේශීය දත්ත පෙන්වයි"
              : "Some map tiles unavailable · local network data remains visible"}
          </span>
          <button
            type="button"
            onClick={() => {
              setOffline(false);
              runtime.current?.tiles.redraw();
            }}
          >
            {si ? "නැවත උත්සාහ කරන්න" : "Retry"}
          </button>
        </div>
      )}
    </div>
  );
}
