import { RELAYS, heatingRate, SCENARIOS, type ScenarioId } from "./protection";
import {
  createAssets,
  createLines,
  busPositions,
  TECH,
  ECONOMY,
} from "./network";
export { busPositions };
// One real second advances twelve grid seconds at normal speed.
export const CLOCK_RATE = 12;
export type Asset = {
  id: string;
  name: string;
  nameSi: string;
  kind:
    "coal" | "oil" | "hydro" | "solar" | "wind" | "bus" | "load" | "battery";
  x: number;
  y: number;
  bus: number;
  capacity: number;
  output: number;
  target: number;
  online: boolean;
  base?: number;
  shed?: boolean;
  autoShed?: number;
  served?: number;
  protectionTimer?: number;
  lockout?: number;
  tripReason?: string;
  water?: number;
  waterMax?: number;
  head?: number;
  inflow?: number;
  waterWarned?: boolean;
  pickup?: number;
  starting?: number;
};
export type Line = {
  id: string;
  from: number;
  to: number;
  capacity: number;
  reactance: number;
  flow: number;
  online: boolean;
  heat: number;
  lockout: number;
  tripReason?: string;
  warned?: boolean;
};
export type Notice = {
  id: number;
  time: number;
  level: "info" | "warning" | "critical";
  text: string;
  textSi: string;
  asset?: string;
};
export type Sample = {
  time: number;
  demand: number;
  generation: number;
  frequency: number;
  forecastDemand: number;
  forecastGeneration: number;
};
export type State = {
  restoration?: { auxiliary: boolean; stable: number };
  version: 2;
  time: number;
  speed: number;
  paused: boolean;
  frequency: number;
  demand: number;
  generation: number;
  unserved: number;
  money: number;
  cost: number;
  reliability: number;
  renewable: number;
  energy: number;
  missed: number;
  battery: number;
  weather: string;
  assets: Asset[];
  lines: Line[];
  events: Notice[];
  history: Sample[];
  finished: boolean;
  storm: boolean;
  difficulty: string;
  scenario: ScenarioId;
  contingency: boolean;
  busFrequency: number[];
  sheddingTimers: number[];
  frequencyAlarm: boolean;
  blackoutTimer: number;
  frequencyFailureTimer: number;
  outcome: "running" | "completed" | "blackout";
  failureCause: string;
  failureCauseSi: string;
  revenue: number;
  fuelCost: number;
  environmentCost: number;
  outageCost: number;
  upgradeCost: number;
  emissions: number;
  waterUsed: number;
  ecology: number;
  demandShock: number;
  forecastPlan: { id: string; target: number; online: boolean }[];
};
export type Command =
  | { type: "target"; id: string; value: number }
  | { type: "toggle"; id: string }
  | { type: "speed"; value: number }
  | { type: "pause" }
  | { type: "upgrade"; id: string }
  | { type: "reset"; difficulty?: string; scenario?: ScenarioId }
  | { type: "restore"; state: State }
  | { type: "plan" }
  | { type: "auxiliary" }
  | { type: "pickup"; id: string; value: number };
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const demandFactor = (hour: number) =>
  0.78 +
  0.2 * Math.exp(-(((hour - 9) / 3) ** 2)) +
  0.45 * Math.exp(-(((hour - 19) / 2.6) ** 2));
export const solarFactor = (hour: number) =>
  Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
export const windFactor = (hour: number) =>
  clamp(0.62 + 0.18 * Math.sin(hour / 3), 0.2, 0.9);
export function demandAt(s: State, time: number, predicted = false) {
  const base = s.assets
    .filter((a) => a.kind === "load")
    .reduce((v, a) => v + (a.base ?? 0), 0);
  const elapsed = time - 28800;
  return (
    base *
    demandFactor((time / 3600) % 24) *
    (predicted
      ? 1
      : (1 +
          0.025 * Math.sin(elapsed / 1200) +
          0.012 * Math.sin(elapsed / 470)) *
        s.demandShock)
  );
}
export function forecastAt(s: State, time: number) {
  const hour = (time / 3600) % 24;
  let generation = 0;
  for (const p of s.forecastPlan) {
    const a = s.assets.find((a) => a.id === p.id);
    if (!a || !p.online) continue;
    generation +=
      a.kind === "solar"
        ? Math.min(p.target, a.capacity * solarFactor(hour))
        : a.kind === "wind"
          ? Math.min(p.target, a.capacity * windFactor(hour))
          : p.target;
  }
  return { time, demand: demandAt(s, time, true), generation };
}
export function notice(
  s: State,
  text: string,
  level: Notice["level"] = "info",
  asset?: string,
  textSi = text,
) {
  s.events.unshift({
    id: (s.events[0]?.id ?? 0) + 1,
    time: s.time,
    level,
    text,
    textSi,
    asset,
  });
  s.events = s.events.slice(0, 100);
}
export function createState(
  difficulty = "normal",
  scenario: ScenarioId = "first-shift",
): State {
  const assets = createAssets();
  if (scenario === "dry-season")
    for (const a of assets) if (a.water !== undefined) a.water *= 0.25;
  const s: State = {
    version: 2,
    time: 28800,
    speed: 1,
    paused: true,
    frequency: 50,
    demand: 0,
    generation: 0,
    unserved: 0,
    money: ECONOMY.initialFunds,
    cost: 0,
    reliability: 100,
    renewable: 0,
    energy: 0,
    missed: 0,
    battery: 320,
    weather: "Clear skies",
    assets,
    lines: createLines(difficulty),
    events: [],
    history: [],
    finished: false,
    storm: false,
    difficulty,
    scenario,
    contingency: false,
    busFrequency: busPositions.map(() => 50),
    sheddingTimers: busPositions.map(() => 0),
    frequencyAlarm: false,
    blackoutTimer: 0,
    frequencyFailureTimer: 0,
    outcome: "running",
    failureCause: "",
    failureCauseSi: "",
    revenue: 0,
    fuelCost: 0,
    environmentCost: 0,
    outageCost: 0,
    upgradeCost: 0,
    emissions: 0,
    waterUsed: 0,
    ecology: 100,
    demandShock: 1,
    forecastPlan: [],
  };
  for (const a of assets) {
    if (a.kind === "load") a.output = (a.base ?? 0) * demandFactor(8);
    if (a.kind === "wind") a.output = a.capacity * windFactor(8);
  }
  const rest = assets
    .filter((a) => a.kind !== "load" && a.id !== "G1")
    .reduce((v, a) => v + a.output, 0);
  const coal = assets[0];
  coal.output = coal.target = clamp(
    demandAt(s, s.time) - rest,
    0,
    coal.capacity,
  );
  if (scenario === "cascade") {
    s.lines[0].capacity = 140;
    s.lines[1].capacity = 145;
    s.lines[9].capacity = 165;
  }
  if (scenario === "black-start") {
    s.restoration = { auxiliary: false, stable: 0 };
    s.busFrequency.fill(0);
    for (const a of assets) {
      a.output = 0;
      if (a.kind === "load") a.pickup = 0;
      else a.online = false;
    }
    for (const l of s.lines) l.online = false;
  }
  s.forecastPlan = assets
    .filter((a) => a.kind !== "bus" && a.kind !== "load")
    .map((a) => ({ id: a.id, target: a.target, online: a.online }));
  refreshNetwork(s, 0);
  notice(
    s,
    scenario === "black-start"
      ? "Island blackout. Open the restoration checklist to begin."
      : "Sri Lanka grid online. Your shift starts now.",
    "info",
    undefined,
    scenario === "black-start"
      ? "දිවයින අඳුරේ. ප්‍රතිස්ථාපන පියවර විවෘත කරන්න."
      : "ශ්‍රී ලංකා විදුලි ජාලය සූදානම්. ඔබේ මුරය දැන් ඇරඹේ.",
  );
  record(s);
  return s;
}
function solve(matrix: number[][], rhs: number[]) {
  const n = rhs.length,
    a = matrix.map((r, i) => [...r, rhs[i]]);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++)
      if (Math.abs(a[k][i]) > Math.abs(a[pivot][i])) pivot = k;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    const d = a[i][i];
    if (Math.abs(d) < 1e-10) throw Error("Singular grid matrix");
    for (let j = i; j <= n; j++) a[i][j] /= d;
    for (let k = 0; k < n; k++)
      if (k !== i) {
        const f = a[k][i];
        for (let j = i; j <= n; j++) a[k][j] -= f * a[i][j];
      }
  }
  return a.map((r) => r[n]);
}
export function powerFlow(injection: number[], lines: Line[]) {
  const groups: number[][] = [],
    seen = new Set<number>();
  for (let i = 0; i < injection.length; i++) {
    if (seen.has(i)) continue;
    const g = [i];
    seen.add(i);
    for (let p = 0; p < g.length; p++)
      for (const l of lines) {
        if (!l.online) continue;
        const j = l.from === g[p] ? l.to : l.to === g[p] ? l.from : -1;
        if (j >= 0 && j < injection.length && !seen.has(j)) {
          seen.add(j);
          g.push(j);
        }
      }
    groups.push(g);
  }
  for (const l of lines) l.flow = 0;
  for (const g of groups) {
    if (g.length < 2) continue;
    const ids = g.slice(1),
      links = lines.filter(
        (l) => l.online && g.includes(l.from) && g.includes(l.to),
      );
    const B = ids.map((i) =>
      ids.map((j) =>
        i === j
          ? links
              .filter((l) => l.from === i || l.to === i)
              .reduce((v, l) => v + 1 / l.reactance, 0)
          : -links
              .filter(
                (l) =>
                  (l.from === i && l.to === j) || (l.to === i && l.from === j),
              )
              .reduce((v, l) => v + 1 / l.reactance, 0),
      ),
    );
    const residual = g.reduce((v, i) => v + injection[i], 0);
    const angles = solve(
      B,
      ids.map((i) => injection[i] - residual / g.length),
    );
    const theta = new Map<number, number>([
      [g[0], 0],
      ...ids.map((id, i): [number, number] => [id, angles[i]]),
    ]);
    for (const l of links)
      l.flow = (theta.get(l.from)! - theta.get(l.to)!) / l.reactance;
  }
  return groups;
}
export function refreshNetwork(s: State, dt: number) {
  const injection = busPositions.map(() => 0),
    groups = powerFlow(injection, s.lines);
  s.demand = 0;
  s.generation = 0;
  s.unserved = 0;
  let cost = 0,
    renewable = 0;
  const baseTotal = s.assets
      .filter((a) => a.kind === "load")
      .reduce((v, a) => v + (a.base ?? 0), 0),
    factor = demandAt(s, s.time) / Math.max(1, baseTotal);
  for (const g of groups) {
    const members = s.assets.filter((a) => g.includes(a.bus)),
      sources = members.filter(
        (a) => a.kind !== "bus" && a.kind !== "load" && a.online,
      ),
      loads = members.filter((a) => a.kind === "load");
    for (const a of loads)
      a.output =
        (a.base ?? 0) *
        factor *
        (a.pickup ?? 1) *
        (1 - Math.max(a.shed ? 0.3 : 0, a.autoShed ?? 0));
    const cranking = s.restoration
      ? members.filter((a) => a.starting && a.id !== "G4").length * 5
      : 0;
    for (const a of members.filter((a) => a.starting && a.id !== "G4"))
      injection[a.bus] -= 5;
    const mechanical = sources.reduce((v, a) => v + Math.max(0, a.output), 0),
      need =
        cranking +
        loads.reduce((v, a) => v + a.output, 0) +
        sources.reduce((v, a) => v + Math.max(0, -a.output), 0);
    const live = g.map((b) => s.busFrequency[b]).filter((f) => f > 0);
    // A disconnected load or an idle/charging inverter cannot maintain a bus.
    // Synchronous units may remain energized at zero active-power dispatch.
    const energized = sources.some(
      (a) => ["coal", "oil", "hydro"].includes(a.kind) || a.output > 1e-6,
    );
    const prev = live.length
      ? live.reduce((v, f) => v + f, 0) / live.length
      : energized
        ? 50
        : 0;
    // Reduced swing equation: imbalance changes rotor speed; load damping is explicit.
    // Installed idle capacity no longer hides surplus. No automatic economic redispatch.
    const inertia = Math.max(
      300,
      sources.reduce((v, a) => v + TECH[a.kind].inertia * a.capacity, 0),
    );
    const base = Math.max(300, need, mechanical);
    const rocof = clamp(
      (50 * (mechanical - need - base * 0.06 * (prev - 50))) / (2 * inertia),
      -1.2,
      1.2,
    );
    const hz = !energized
      ? 0
      : dt > 0
        ? clamp(prev + rocof * dt, 45, 55)
        : prev;
    for (const a of members.filter((a) => a.kind === "bus")) a.online = hz > 0;
    for (const b of g) s.busFrequency[b] = hz;
    const supplied = Math.min(1, mechanical / Math.max(1, need)),
      used = Math.min(1, need / Math.max(1, mechanical));
    for (const a of loads) {
      a.served = a.output * supplied;
      injection[a.bus] -= a.served;
      s.demand += (a.base ?? 0) * factor;
      s.unserved += Math.max(0, (a.base ?? 0) * factor - a.served);
    }
    for (const a of sources) {
      injection[a.bus] += a.output >= 0 ? a.output * used : a.output * supplied;
      s.generation += a.output;
      cost += Math.max(0, a.output) * TECH[a.kind].cost;
      if (["hydro", "wind", "solar"].includes(a.kind)) renewable += a.output;
    }
  }
  powerFlow(injection, s.lines);
  s.frequency = s.busFrequency
    .filter((f) => f > 0)
    .reduce(
      (worst, f) => (Math.abs(f - 50) > Math.abs(worst - 50) ? f : worst),
      s.busFrequency.some((f) => f > 0) ? 50 : 0,
    );
  s.cost = cost / Math.max(1, s.generation);
  s.renewable = clamp((renewable / Math.max(1, s.generation)) * 100, 0, 100);
  return { groups, cost };
}
function tripLine(s: State, l: Line, reason: string, si: string) {
  l.online = false;
  l.flow = 0;
  l.lockout = RELAYS.lineLockout;
  l.tripReason = reason;
  notice(
    s,
    `${l.id} tripped: ${reason}. Power rerouted.`,
    "critical",
    l.id,
    `${l.id} විසන්ධි විය: ${si}. බල ප්‍රවාහය වෙනත් මාර්ග වෙත යොමු විය.`,
  );
  s.speed = 1;
}
function tripGenerator(s: State, a: Asset, reason: string, si: string) {
  a.online = false;
  a.output = 0;
  a.protectionTimer = 0;
  a.lockout = RELAYS.generatorLockout;
  a.tripReason = reason;
  notice(
    s,
    `${a.name} tripped: ${reason}.`,
    "critical",
    a.id,
    `${a.nameSi} විසන්ධි විය: ${si}.`,
  );
  s.speed = 1;
}
export function command(s: State, c: Command): State {
  if (c.type === "reset") return createState(c.difficulty, c.scenario);
  if (c.type === "restore")
    return validSave(c.state)
      ? { ...structuredClone(c.state), paused: true }
      : s;
  if (s.finished) return s;
  if (c.type === "pause") {
    s.paused = !s.paused;
    return s;
  }
  if (c.type === "speed") {
    if ([1, 2, 5, 10, 30].includes(c.value)) s.speed = c.value;
    return s;
  }
  if (c.type === "plan") {
    s.forecastPlan = s.assets
      .filter((a) => a.kind !== "bus" && a.kind !== "load")
      .map((a) => ({ id: a.id, target: a.target, online: a.online }));
    notice(
      s,
      "Dispatch forecast updated from current targets.",
      "info",
      undefined,
      "දැනට ඇති ඉලක්ක අනුව ජනන පුරෝකථනය යාවත්කාලීන විය.",
    );
    return s;
  }
  if (c.type === "auxiliary") {
    if (s.restoration && !s.restoration.auxiliary && s.battery >= 2) {
      s.battery -= 2;
      s.restoration.auxiliary = true;
      notice(
        s,
        "Station auxiliaries ready. Start Upper Kotmale (G4).",
        "info",
        "G4",
        "සහායක බලය සූදානම්. ඉහළ කොත්මලේ (G4) අරඹන්න.",
      );
    }
    return s;
  }
  const a = s.assets.find((a) => a.id === c.id),
    l = s.lines.find((l) => l.id === c.id);
  if (
    c.type === "pickup" &&
    s.restoration &&
    a?.kind === "load" &&
    Number.isFinite(c.value)
  ) {
    const next = clamp(c.value, 0, 1);
    const group = powerFlow(
      busPositions.map(() => 0),
      s.lines,
    ).find((g) => g.includes(a.bus))!;
    const sources = s.assets.filter(
      (b) =>
        group.includes(b.bus) &&
        b.online &&
        b.kind !== "bus" &&
        b.kind !== "load",
    );
    const reserve = sources.reduce(
      (v, b) => v + Math.max(0, b.target - b.output),
      0,
    );
    const added =
      (next - (a.pickup ?? 0)) *
      (a.base ?? 0) *
      demandFactor((s.time / 3600) % 24);
    if (
      next > (a.pickup ?? 0) &&
      (next - (a.pickup ?? 0) > 0.100001 ||
        s.busFrequency[a.bus] < 49.5 ||
        s.busFrequency[a.bus] > 50.5 ||
        added > Math.min(35, reserve * 0.8))
    ) {
      notice(
        s,
        "Pickup blocked: energize this bus, stabilize frequency and keep reserve. Reconnect at most 10% at a time.",
        "warning",
        a.id,
        "සම්බන්ධ කිරීම අවහිරයි: බස්බාරයට බලය සපයා සංඛ්‍යාතය සහ සංචිතය පවත්වාගන්න. වරකට 10% බැගින් සම්බන්ධ කරන්න.",
      );
      return s;
    }
    a.pickup = next;
    a.shed = false;
    a.autoShed = 0;
    notice(
      s,
      `${a.name}: ${Math.round(next * 100)}% reconnected.`,
      "info",
      a.id,
      `${a.nameSi}: ${Math.round(next * 100)}% සම්බන්ධ කළා.`,
    );
  }
  if (c.type === "target" && a && Number.isFinite(c.value))
    a.target = clamp(
      c.value,
      a.kind === "battery" ? -a.capacity : 0,
      a.capacity,
    );
  if (c.type === "toggle") {
    if (l) {
      if (!l.online && l.lockout > 0) return s;
      if (s.restoration && !l.online) {
        const f = s.busFrequency[l.from],
          t = s.busFrequency[l.to];
        if (
          (!f && !t) ||
          (f && Math.abs(f - 50) > 0.5) ||
          (t && Math.abs(t - 50) > 0.5) ||
          (f && t && Math.abs(f - t) > 0.2)
        ) {
          notice(
            s,
            "Breaker blocked: establish a stable source; live islands must be within 0.2 Hz.",
            "warning",
            l.id,
            "පරිපථ කඩනය අවහිරයි: ස්ථාවර සැපයුමක් අවශ්‍යයි. සජීවී කොටස් අතර වෙනස Hz 0.2ට අඩු විය යුතුය.",
          );
          return s;
        }
      }
      l.online = !l.online;
      l.tripReason = undefined;
      notice(
        s,
        `${l.id} breaker ${l.online ? "closed" : "opened"}.`,
        "info",
        l.id,
        `${l.id} පරිපථ කඩනය ${l.online ? "සම්බන්ධ" : "විසන්ධි"} කළා.`,
      );
    } else if (a?.kind === "load") {
      if (s.restoration)
        return command(s, {
          type: "pickup",
          id: a.id,
          value: Math.min(1, (a.pickup ?? 0) + 0.1),
        });
      if (a.autoShed) {
        a.autoShed = 0;
        a.shed = false;
      } else a.shed = !a.shed;
      notice(
        s,
        `${a.name}: demand ${a.shed ? "curtailed" : "restored"}.`,
        "info",
        a.id,
        `${a.nameSi}: ඉල්ලුම ${a.shed ? "සීමා" : "ප්‍රතිස්ථාපනය"} කළා.`,
      );
    } else if (a && a.kind !== "bus") {
      if (!a.online && (a.lockout ?? 0) > 0) return s;
      if (s.restoration && !a.online) {
        if (a.starting) return s;
        const hz = s.busFrequency[a.bus];
        const seed = a.id === "G4" && s.restoration.auxiliary;
        if (!seed && (hz < 49.5 || hz > 50.5)) {
          notice(
            s,
            "Start blocked: generator needs a live, stable bus. G4 can black-start after auxiliaries are ready.",
            "warning",
            a.id,
            "ආරම්භය අවහිරයි: ස්ථාවර සජීවී බස්බාරයක් අවශ්‍යයි. සහායක බලය ලැබුණු පසු G4 ආරම්භ කළ හැක.",
          );
          return s;
        }
        a.starting = a.kind === "coal" || a.kind === "oil" ? 30 : 8;
        notice(
          s,
          `${a.name}: startup sequence running.`,
          "info",
          a.id,
          `${a.nameSi}: ආරම්භක අනුක්‍රමය ක්‍රියාත්මකයි.`,
        );
        return s;
      }
      a.online = !a.online;
      a.tripReason = undefined;
      if (!a.online) a.output = 0;
    }
  }
  if (c.type === "upgrade" && l && s.money >= ECONOMY.lineUpgrade) {
    s.money -= ECONOMY.lineUpgrade;
    s.upgradeCost += ECONOMY.lineUpgrade;
    l.capacity += 200;
    notice(
      s,
      `${l.id}: capacity upgraded by 200 MW.`,
      "info",
      l.id,
      `${l.id}: ධාරිතාව MW 200කින් වැඩි කළා.`,
    );
  }
  refreshNetwork(s, 0);
  return s;
}
function record(s: State) {
  const p = forecastAt(s, s.time);
  s.history.push({
    time: s.time,
    demand: s.demand,
    generation: s.generation,
    frequency: s.frequency,
    forecastDemand: p.demand,
    forecastGeneration: p.generation,
  });
  s.history = s.history.slice(-481);
}
function tick(s: State, dt: number) {
  s.time += dt * CLOCK_RATE;
  const hours = (dt * CLOCK_RATE) / 3600,
    hour = (s.time / 3600) % 24;
  s.weather = s.time >= 46800 && s.time < 57600 ? "Storm front" : "Clear skies";
  s.demandShock =
    s.scenario === "load-rejection" && s.time >= 37800 && s.time < 43200
      ? 0.45
      : 1;
  if (s.restoration) {
    for (const a of s.assets)
      if (a.starting) {
        const hz = s.busFrequency[a.bus];
        if (a.id !== "G4" && (hz < 47.5 || hz > 52.5)) {
          a.starting = 0;
          notice(
            s,
            `${a.name}: startup aborted; auxiliary supply lost.`,
            "warning",
            a.id,
            `${a.nameSi}: සහායක සැපයුම නැති නිසා ආරම්භය නතර විය.`,
          );
          continue;
        }
        // Hold synchronization until frequency returns to the normal band.
        a.starting = Math.max(
          a.id !== "G4" && (hz < 49.5 || hz > 50.5) ? 0.05 : 0,
          a.starting - dt,
        );
        if (!a.starting) {
          a.online = true;
          notice(
            s,
            `${a.name}: synchronized. Governor follows connected demand within dispatch limits.`,
            "info",
            a.id,
            `${a.nameSi}: සමමුහුර්ත කළා. ජනන සීමාව තුළ ඉල්ලුම අනුව පාලනය වේ.`,
          );
        }
      }
  }
  const restorationTargets = new Map<string, number>();
  if (s.restoration)
    for (const group of powerFlow(
      busPositions.map(() => 0),
      s.lines,
    )) {
      const sources = s.assets.filter(
        (a) =>
          group.includes(a.bus) &&
          a.online &&
          a.kind !== "bus" &&
          a.kind !== "load",
      );
      const need =
        s.assets.filter(
          (a) => group.includes(a.bus) && a.starting && a.id !== "G4",
        ).length *
          5 +
        s.assets
          .filter((a) => group.includes(a.bus) && a.kind === "load")
          .reduce(
            (v, a) =>
              v +
              (a.base ?? 0) *
                demandFactor(hour) *
                (a.pickup ?? 0) *
                (1 - Math.max(a.shed ? 0.3 : 0, a.autoShed ?? 0)),
            0,
          );
      const capacity = sources.reduce((v, a) => v + Math.max(0, a.target), 0);
      for (const a of sources)
        restorationTargets.set(
          a.id,
          Math.max(0, a.target) * Math.min(1, need / Math.max(1, capacity)),
        );
    }
  for (const l of s.lines) l.lockout = Math.max(0, l.lockout - dt);
  for (const a of s.assets) {
    a.lockout = Math.max(0, (a.lockout ?? 0) - dt);
    if (a.kind === "bus" || a.kind === "load") continue;
    let target = a.online ? (restorationTargets.get(a.id) ?? a.target) : 0;
    if (a.kind === "solar")
      target = a.online
        ? Math.min(
            target,
            a.capacity *
              solarFactor(hour) *
              (s.weather === "Storm front" ? 0.3 : 1),
          )
        : 0;
    if (a.kind === "wind")
      target = a.online
        ? Math.min(
            target,
            a.capacity *
              windFactor(hour) *
              (1 + 0.12 * Math.sin(s.time / 1700)),
          )
        : 0;
    if (a.kind === "hydro") {
      a.water = Math.min(
        a.waterMax!,
        a.water! +
          (s.scenario === "dry-season"
            ? 0.005
            : s.weather === "Storm front"
              ? 0.18
              : a.inflow!) *
            hours,
      );
      const potential = (a.water! * 1e6 * 1000 * 9.81 * a.head! * 0.9) / 3.6e9;
      target = Math.min(target, potential / Math.max(1e-9, hours));
    }
    if (a.kind === "battery") {
      target = clamp(
        target,
        -(ECONOMY.batteryCapacity - s.battery) /
          hours /
          ECONOMY.batteryEfficiency,
        (s.battery * ECONOMY.batteryEfficiency) / hours,
      );
      a.output = target;
    } else {
      const ramp = TECH[a.kind].ramp * dt;
      a.output += clamp(target - a.output, -ramp, ramp);
      if (!a.online) a.output = 0;
      if (a.kind === "hydro") a.output = Math.min(a.output, target);
    }
    if (a.kind === "hydro") {
      const water =
        (a.output * hours * 3.6e9) / (1000 * 9.81 * a.head! * 0.9 * 1e6);
      a.water = Math.max(0, a.water! - water);
      s.waterUsed += water;
      const stress = a.water! / a.waterMax! < 0.2 ? 4 : 1;
      s.environmentCost += water * ECONOMY.waterImpactPerMm3 * stress;
      s.money -= water * ECONOMY.waterImpactPerMm3 * stress;
      if (a.water! / a.waterMax! < 0.2 && !a.waterWarned) {
        a.waterWarned = true;
        notice(
          s,
          `${a.name}: reservoir below 20%. Conserve water.`,
          "warning",
          a.id,
          `${a.nameSi}: ජලාශය 20%ට අඩුයි. ජලය සුරකින්න.`,
        );
      }
    }
  }
  if (
    !s.contingency &&
    s.time >= (s.scenario === "cascade" ? 32400 : 37800) &&
    ["generator-loss", "cascade", "load-rejection"].includes(s.scenario)
  ) {
    s.contingency = true;
    if (s.scenario === "generator-loss")
      tripGenerator(
        s,
        s.assets.find((a) => a.id === "G1")!,
        "turbine fault",
        "ටර්බයින දෝෂය",
      );
    if (s.scenario === "cascade")
      tripLine(s, s.lines[5], "corridor fault", "සම්ප්‍රේෂණ මාර්ගයේ දෝෂය");
    if (s.scenario === "load-rejection") {
      notice(
        s,
        "Large demand rejection: reduce generation or charge storage.",
        "critical",
        undefined,
        "විශාල ඉල්ලුම් පහළ යාමක්: ජනනය අඩු කරන්න හෝ බැටරි ආරෝපණය කරන්න.",
      );
      s.speed = 1;
    }
  }
  if (!s.restoration && s.time >= 46800 && !s.storm) {
    s.storm = true;
    tripLine(s, s.lines[3], "monsoon fault", "මෝසම් කුණාටු දෝෂය");
  }
  let { groups, cost } = refreshNetwork(s, dt);
  for (const g of groups) {
    const hz = s.busFrequency[g[0]],
      timer =
        hz > 0 && hz < RELAYS.sheddingLow ? s.sheddingTimers[g[0]] + dt : 0;
    for (const b of g) s.sheddingTimers[b] = timer;
    if (timer >= RELAYS.sheddingDelay) {
      let changed = false;
      for (const a of s.assets.filter(
        (a) => a.kind === "load" && g.includes(a.bus),
      )) {
        if ((a.autoShed ?? 0) < 0.4) {
          a.autoShed = Math.min(0.4, (a.autoShed ?? 0) + 0.2);
          changed = true;
        }
      }
      for (const b of g) s.sheddingTimers[b] = 0;
      if (changed) {
        notice(
          s,
          `Automatic underfrequency load shedding: S${g[0] + 1} (${hz.toFixed(2)} Hz).`,
          "critical",
          `S${g[0] + 1}`,
          `අඩු සංඛ්‍යාත ස්වයංක්‍රීය බර අඩු කිරීම: S${g[0] + 1} (${hz.toFixed(2)} Hz).`,
        );
        s.speed = 1;
      }
    }
  }
  for (const a of s.assets.filter(
    (a) => a.online && !["load", "bus", "battery"].includes(a.kind),
  )) {
    const hz = s.busFrequency[a.bus];
    a.protectionTimer =
      hz < RELAYS.generatorLow || hz > RELAYS.generatorHigh
        ? (a.protectionTimer ?? 0) + dt
        : Math.max(0, (a.protectionTimer ?? 0) - 2 * dt);
    if (a.protectionTimer >= RELAYS.generatorDelay)
      tripGenerator(
        s,
        a,
        `${hz > 50 ? "overfrequency" : "underfrequency"} ${hz.toFixed(2)} Hz`,
        `${hz > 50 ? "අධි සංඛ්‍යාතය" : "අඩු සංඛ්‍යාතය"} ${hz.toFixed(2)} Hz`,
      );
  }
  refreshNetwork(s, 0);
  for (const l of s.lines) {
    const ratio = Math.abs(l.flow) / l.capacity;
    l.heat =
      l.online && ratio > 1
        ? l.heat + dt * heatingRate(ratio)
        : Math.max(0, l.heat - dt * RELAYS.thermalCooling);
    if (l.online && ratio > 0.9 && !l.warned) {
      l.warned = true;
      notice(
        s,
        `${l.id}: ${Math.round(ratio * 100)}% loading.`,
        "warning",
        l.id,
        `${l.id}: බර ${Math.round(ratio * 100)}%.`,
      );
      if (ratio > 1) s.speed = 1;
    }
    if (ratio < 0.85) l.warned = false;
    if (l.online && l.heat >= RELAYS.thermalLimit) {
      tripLine(
        s,
        l,
        `thermal overload ${Math.round(ratio * 100)}%`,
        `තාප අධිබර ${Math.round(ratio * 100)}%`,
      );
      refreshNetwork(s, 0);
    }
  }
  ({ groups, cost } = refreshNetwork(s, 0));
  const battery = s.assets.find((a) => a.kind === "battery")!,
    g = groups.find((g) => g.includes(battery.bus))!,
    members = s.assets.filter((a) => g.includes(a.bus));
  const generated = members
      .filter((a) => a.online && a.kind !== "load")
      .reduce((v, a) => v + Math.max(0, a.output), 0),
    need =
      members
        .filter((a) => a.kind === "load")
        .reduce((v, a) => v + a.output, 0) + Math.max(0, -battery.output);
  const actual =
    battery.output < 0
      ? battery.output * Math.min(1, generated / Math.max(1, need))
      : battery.output * Math.min(1, need / Math.max(1, generated));
  s.battery = clamp(
    s.battery -
      (actual >= 0
        ? actual / ECONOMY.batteryEfficiency
        : actual * ECONOMY.batteryEfficiency) *
        hours,
    0,
    ECONOMY.batteryCapacity,
  );
  const alarm = s.busFrequency.some((f) => f > 0 && (f < 49.5 || f > 50.5));
  if (alarm && !s.frequencyAlarm) {
    notice(
      s,
      `Frequency ${s.frequency.toFixed(2)} Hz: rebalance dispatch.`,
      "warning",
      undefined,
      `සංඛ්‍යාතය ${s.frequency.toFixed(2)} Hz: ජනනය හා ඉල්ලුම සමතුලිත කරන්න.`,
    );
    s.speed = 1;
  }
  s.frequencyAlarm = alarm;
  const emission = s.assets
    .filter((a) => a.online)
    .reduce(
      (v, a) => v + Math.max(0, a.output) * TECH[a.kind].emissions * hours,
      0,
    );
  s.emissions += emission;
  const carbon = emission * ECONOMY.carbonPrice,
    revenue =
      Math.max(0, s.demand - s.unserved) * ECONOMY.revenuePerMWh * hours,
    penalty = s.unserved * ECONOMY.unservedPenaltyPerMWh * hours;
  s.fuelCost += cost * hours;
  s.revenue += revenue;
  s.environmentCost += carbon;
  s.outageCost += penalty;
  s.money += revenue - cost * hours - carbon - penalty;
  s.energy += s.demand * hours;
  s.missed += s.unserved * hours;
  s.reliability = clamp(100 * (1 - s.missed / Math.max(1, s.energy)), 0, 100);
  s.ecology = clamp(100 - s.emissions / 150 - s.waterUsed * 1.5, 0, 100);
  s.blackoutTimer =
    !s.restoration && s.unserved > s.demand * 0.5
      ? s.blackoutTimer + dt
      : Math.max(0, s.blackoutTimer - 2 * dt);
  const energized = s.assets.filter(
    (a) => a.kind === "load" && (a.base ?? 0) > 0,
  );
  const extreme = energized.some(
    (a) =>
      s.busFrequency[a.bus] > 0 &&
      (s.busFrequency[a.bus] > 52.5 || s.busFrequency[a.bus] < 47.5),
  );
  s.frequencyFailureTimer = extreme
    ? s.frequencyFailureTimer + dt
    : Math.max(0, s.frequencyFailureTimer - dt * 2);
  if (s.restoration) {
    const restored = s.assets
      .filter((a) => a.kind === "load")
      .every(
        (a) =>
          (a.pickup ?? 0) >= 0.99 &&
          (a.served ?? 0) >= (a.base ?? 0) * demandFactor(hour) * 0.95,
      );
    s.restoration.stable = restored && !alarm ? s.restoration.stable + dt : 0;
    if (s.restoration.stable >= 20) {
      s.finished = true;
      s.paused = true;
      s.outcome = "completed";
      notice(
        s,
        "Island restored. All communities supplied; frequency stable for 20 seconds.",
        "info",
        undefined,
        "දිවයිනේ සැපයුම යථා තත්ත්වයට පත් විය. සියලු ජනාවාසවලට විදුලිය සහ තත්පර 20ක් ස්ථාවර සංඛ්‍යාතය.",
      );
    }
  }
  if (
    (s.restoration && s.time >= 115200 && !s.finished) ||
    s.blackoutTimer >= RELAYS.blackoutDelay ||
    s.frequencyFailureTimer >= RELAYS.frequencyFailureDelay
  ) {
    s.outcome = "blackout";
    s.finished = true;
    s.paused = true;
    s.failureCause =
      s.frequency > 50 ||
      s.events.some((e) => e.text.includes("tripped: overfrequency"))
        ? "Overfrequency cascade"
        : s.frequencyFailureTimer >= RELAYS.frequencyFailureDelay
          ? "Frequency collapse"
          : "Supply collapse";
    s.failureCauseSi =
      s.frequency > 50 ||
      s.events.some((e) => e.text.includes("tripped: overfrequency"))
        ? "අධි සංඛ්‍යාත දාම බිඳවැටීම"
        : s.frequencyFailureTimer >= RELAYS.frequencyFailureDelay
          ? "සංඛ්‍යාත බිඳවැටීම"
          : "සැපයුම් බිඳවැටීම";
    if (s.restoration && s.time >= 115200) {
      s.time = 115200;
      s.failureCause = "Restoration deadline missed";
      s.failureCauseSi = "ප්‍රතිස්ථාපන කාල සීමාව ඉක්මවා ගියා";
    }
    for (const a of s.assets) {
      if (a.kind === "load") a.served = 0;
      else {
        a.online = false;
        a.output = 0;
      }
    }
    for (const l of s.lines) {
      l.online = false;
      l.flow = 0;
    }
    s.generation = 0;
    s.busFrequency.fill(0);
    s.frequency = 0;
    s.unserved = s.demand;
    notice(s, s.failureCause, "critical", undefined, s.failureCauseSi);
  } else if (!s.restoration && s.time >= 115200) {
    s.time = 115200;
    s.outcome = "completed";
    s.finished = true;
    s.paused = true;
    notice(s, "Shift completed.", "info", undefined, "මුරය අවසන්.");
  }
  if (Math.floor(s.time / 180) !== Math.floor((s.time - dt * CLOCK_RATE) / 180))
    record(s);
}
export function step(s: State, realDt: number) {
  if (s.paused || s.finished || !Number.isFinite(realDt) || realDt <= 0)
    return s;
  const speed = s.speed;
  let remaining = realDt * speed;
  while (remaining > 1e-9 && !s.finished) {
    const dt = Math.min(0.05, remaining);
    tick(s, dt);
    remaining -= dt;
    if (s.speed !== speed) break;
  }
  return s;
}
export function validSave(v: unknown): v is State {
  if (!v || typeof v !== "object") return false;
  const s = v as State;
  const base = createAssets();
  return (
    s.version === 2 &&
    [
      "time",
      "frequency",
      "money",
      "battery",
      "energy",
      "missed",
      "revenue",
      "fuelCost",
      "environmentCost",
      "outageCost",
      "upgradeCost",
      "emissions",
      "waterUsed",
      "ecology",
      "blackoutTimer",
      "frequencyFailureTimer",
      "demandShock",
      "demand",
      "generation",
      "unserved",
      "cost",
      "reliability",
      "renewable",
    ].every((k) =>
      Number.isFinite((s as unknown as Record<string, unknown>)[k]),
    ) &&
    s.time >= 28800 &&
    s.time <= 115200 &&
    s.battery >= 0 &&
    s.battery <= 600 &&
    [1, 2, 5, 10, 30].includes(s.speed) &&
    ["paused", "finished", "storm", "contingency", "frequencyAlarm"].every(
      (k) => typeof (s as unknown as Record<string, unknown>)[k] === "boolean",
    ) &&
    ["running", "blackout", "completed"].includes(s.outcome) &&
    typeof s.failureCause === "string" &&
    typeof s.failureCauseSi === "string" &&
    ["easy", "normal", "expert"].includes(s.difficulty) &&
    SCENARIOS.some((m) => m.id === s.scenario) &&
    (s.scenario === "black-start" || s.restoration === undefined) &&
    (s.scenario !== "black-start" ||
      (!!s.restoration &&
        typeof s.restoration.auxiliary === "boolean" &&
        Number.isFinite(s.restoration.stable) &&
        s.restoration.stable >= 0)) &&
    Array.isArray(s.assets) &&
    s.assets.length === base.length &&
    base.every(
      (a) =>
        s.assets.filter(
          (b) =>
            b &&
            b.id === a.id &&
            b.kind === a.kind &&
            b.bus === a.bus &&
            typeof b.name === "string" &&
            typeof b.nameSi === "string" &&
            typeof b.online === "boolean" &&
            ["output", "target", "capacity", "x", "y"].every((k) =>
              Number.isFinite((b as unknown as Record<string, unknown>)[k]),
            ) &&
            [
              b.base,
              b.lockout,
              b.autoShed,
              b.protectionTimer,
              b.served,
              b.water,
              b.waterMax,
              b.head,
              b.inflow,
              b.starting,
              b.pickup,
            ].every((n) => n === undefined || (Number.isFinite(n) && n >= 0)) &&
            (b.pickup === undefined || b.pickup <= 1) &&
            (s.scenario !== "black-start" ||
              b.kind !== "load" ||
              Number.isFinite(b.pickup)) &&
            (b.kind !== "hydro" ||
              (Number.isFinite(b.water) &&
                Number.isFinite(b.waterMax) &&
                Number.isFinite(b.head) &&
                Number.isFinite(b.inflow) &&
                b.head! > 0 &&
                b.water! <= b.waterMax!)),
        ).length === 1,
    ) &&
    Array.isArray(s.lines) &&
    s.lines.length === 18 &&
    createLines(s.difficulty).every(
      (a) =>
        s.lines.filter(
          (b) =>
            b &&
            b.id === a.id &&
            b.from === a.from &&
            b.to === a.to &&
            typeof b.online === "boolean" &&
            [b.capacity, b.reactance, b.flow, b.heat, b.lockout].every(
              Number.isFinite,
            ) &&
            b.capacity > 0 &&
            b.reactance > 0 &&
            b.heat >= 0 &&
            b.lockout >= 0,
        ).length === 1,
    ) &&
    [s.busFrequency, s.sheddingTimers].every(
      (a) => Array.isArray(a) && a.length === 10 && a.every(Number.isFinite),
    ) &&
    Array.isArray(s.events) &&
    s.events.every(
      (e) =>
        e &&
        Number.isFinite(e.id) &&
        Number.isFinite(e.time) &&
        typeof e.text === "string" &&
        typeof e.textSi === "string",
    ) &&
    Array.isArray(s.forecastPlan) &&
    s.forecastPlan.every(
      (p) =>
        p &&
        base.some((a) => a.id === p.id) &&
        Number.isFinite(p.target) &&
        typeof p.online === "boolean",
    ) &&
    Array.isArray(s.history) &&
    s.history.every(
      (p) =>
        p &&
        [
          p.time,
          p.demand,
          p.generation,
          p.frequency,
          p.forecastDemand,
          p.forecastGeneration,
        ].every(Number.isFinite),
    )
  );
}
