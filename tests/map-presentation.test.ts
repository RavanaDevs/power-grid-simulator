import { test } from "node:test";
import assert from "node:assert/strict";
import { command, createState, notice, step } from "../src/game/engine";
import {
  getMapAlarms,
  isMapFeatureVisible,
  MAP_CUE_TTL_MS,
  noticeToMapCue,
  updateMapCueTimeline,
  type MapCueTimeline,
} from "../src/simulator/mapPresentation";

test("country-scale equipment stays readable without hiding selected or alarmed details", () => {
  assert.equal(
    isMapFeatureVisible({ zoom: 7, kind: "coal", capacityMW: 900 }),
    true,
  );
  assert.equal(
    isMapFeatureVisible({ zoom: 7, kind: "hydro", capacityMW: 50 }),
    false,
  );
  assert.equal(
    isMapFeatureVisible({ zoom: 7, kind: "hydro", simulationId: "G4" }),
    true,
  );
  assert.equal(
    isMapFeatureVisible({
      zoom: 7,
      kind: "solar",
      capacityMW: 150,
      simulationId: "G3",
    }),
    false,
  );
  assert.equal(
    isMapFeatureVisible({ zoom: 8, kind: "solar", capacityMW: 1 }),
    true,
  );
  assert.equal(isMapFeatureVisible({ zoom: 8.9, kind: "substation" }), false);
  assert.equal(isMapFeatureVisible({ zoom: 9, kind: "substation" }), true);
  assert.equal(isMapFeatureVisible({ zoom: 9.9, kind: "load" }), false);
  assert.equal(isMapFeatureVisible({ zoom: 10, kind: "load" }), true);
  assert.equal(isMapFeatureVisible({ zoom: 10, kind: "bus" }), true);
  assert.equal(
    isMapFeatureVisible({ zoom: 6, kind: "load", selected: true }),
    true,
  );
  assert.equal(
    isMapFeatureVisible({ zoom: 6, kind: "bus", alarm: true }),
    true,
  );
});

test("a real model trip produces a localized visual cue with an equipment target", () => {
  const state = createState();
  let timeline = updateMapCueTimeline(
    { lastEventId: null, cues: [] },
    state,
    100,
  );
  state.lines[0].capacity = 1;
  state.paused = false;
  step(state, 0.1);
  timeline = updateMapCueTimeline(timeline, state, 500);
  const trip = timeline.cues.find((cue) => cue.kind === "trip");
  assert.ok(trip);
  assert.deepEqual(trip.targetIds, ["L1"]);
  assert.equal(trip.level, "critical");
  assert.ok(/[\u0d80-\u0dff]/.test(trip.labelSi));
  assert.ok(trip.detail.includes("thermal overload"));
  assert.equal(trip.observedAtMs, 500);
});

test("transient cues expire by wall time, survive accelerated grid time, and do not replay", () => {
  const state = createState();
  let timeline = updateMapCueTimeline(
    { lastEventId: null, cues: [] },
    state,
    0,
  );
  notice(
    state,
    "L1 tripped: thermal overload.",
    "critical",
    "L1",
    "L1 ආරක්ෂණයෙන් විසන්ධි විය.",
  );
  timeline = updateMapCueTimeline(timeline, state, 1000);
  assert.equal(timeline.cues.length, 1);
  state.time += 60000;
  timeline = updateMapCueTimeline(timeline, state, 1100);
  assert.equal(
    timeline.cues.length,
    1,
    "Fast grid clock must not erase a new alert",
  );
  timeline = updateMapCueTimeline(timeline, state, 1000 + MAP_CUE_TTL_MS);
  assert.equal(timeline.cues.length, 0);
  assert.equal(
    updateMapCueTimeline(timeline, state, 20000).cues.length,
    0,
    "A retained notification is not a fresh event after its cue expires",
  );
});

test("loading a save or resetting a scenario establishes a silent event watermark", () => {
  const saved = createState();
  notice(saved, "L1 tripped: archived fault.", "critical", "L1");
  saved.events[0].id = 100;
  const initial = updateMapCueTimeline(
    { lastEventId: null, cues: [] },
    saved,
    0,
  );
  assert.deepEqual(initial, { lastEventId: 100, cues: [] });
  const old: MapCueTimeline = { lastEventId: 1, cues: [] };
  assert.equal(
    updateMapCueTimeline(old, saved, 100, { reset: true }).cues.length,
    0,
  );
  const reset = updateMapCueTimeline(initial, createState(), 200);
  assert.equal(reset.lastEventId, 1);
  assert.equal(reset.cues.length, 0);
});

test("persistent trips clear after repair even while historical notices remain", () => {
  const state = createState("normal", "generator-loss");
  state.time = 37800;
  state.paused = false;
  step(state, 0.05);
  assert.ok(
    getMapAlarms(state).some(
      (alarm) => alarm.kind === "trip" && alarm.targetIds.includes("G1"),
    ),
  );
  state.assets.find((asset) => asset.id === "G1")!.lockout = 0;
  command(state, { type: "toggle", id: "G1" });
  assert.ok(state.events.some((event) => event.text.includes("tripped:")));
  assert.equal(
    getMapAlarms(state).some(
      (alarm) => alarm.kind === "trip" && alarm.targetIds.includes("G1"),
    ),
    false,
  );
  command(state, { type: "toggle", id: "L2" });
  assert.equal(
    getMapAlarms(state).some((alarm) => alarm.targetIds.includes("L2")),
    false,
    "A manually opened healthy breaker is not a protection trip",
  );
});

test("active shedding is distinct from manual curtailment and dead buses have no frequency alarm", () => {
  const state = createState("normal", "black-start");
  const load = state.assets.find((asset) => asset.id === "D2")!;
  load.shed = true;
  assert.equal(
    getMapAlarms(state).find((alarm) => alarm.kind === "shedding")?.level,
    "info",
  );
  assert.equal(
    getMapAlarms(state).some((alarm) => alarm.kind === "frequency"),
    false,
  );
  load.autoShed = 0.2;
  const alarm = getMapAlarms(state).find((item) => item.kind === "shedding");
  assert.deepEqual(alarm?.targetIds, ["D2"]);
  assert.equal(alarm?.level, "warning");
  load.autoShed = 0;
  load.shed = false;
  assert.equal(
    getMapAlarms(state).some((item) => item.kind === "shedding"),
    false,
  );
});

test("blackout and load-shedding notices retain their distinct meanings", () => {
  const state = createState();
  state.assets.find((asset) => asset.id === "D2")!.autoShed = 0.2;
  state.assets.find((asset) => asset.id === "D3")!.autoShed = 0.2;
  notice(
    state,
    "Automatic underfrequency load shedding: S2 (49.10 Hz).",
    "critical",
    "S2",
    "ස්වයංක්‍රීය භාර අඩු කිරීම",
  );
  assert.equal(noticeToMapCue(state.events[0], state, 10)?.kind, "shedding");
  assert.deepEqual(noticeToMapCue(state.events[0], state, 10)?.targetIds, [
    "S2",
    "D2",
    "D3",
  ]);
  notice(state, "L1 breaker opened.", "info", "L1");
  assert.equal(noticeToMapCue(state.events[0], state, 20), null);
  state.outcome = "blackout";
  state.failureCause = "Supply collapse";
  notice(state, state.failureCause, "critical", undefined, "සැපයුම බිඳවැටීම");
  const cue = noticeToMapCue(state.events[0], state, 30);
  assert.equal(cue?.kind, "blackout");
  assert.equal(cue?.targetIds.length, 10);
  assert.ok(getMapAlarms(state).some((alarm) => alarm.kind === "blackout"));
});

test("manual demand commands create localized curtailed and restored cues", () => {
  const state = createState();
  command(state, { type: "toggle", id: "D1" });
  const curtailed = noticeToMapCue(state.events[0], state, 0);
  assert.equal(curtailed?.kind, "shedding");
  assert.equal(curtailed?.level, "info");
  assert.deepEqual(curtailed?.targetIds, ["D1"]);
  assert.ok(
    getMapAlarms(state).some((alarm) => alarm.targetIds.includes("D1")),
  );
  command(state, { type: "toggle", id: "D1" });
  const restored = noticeToMapCue(state.events[0], state, 100);
  assert.equal(restored?.label, "Load restored");
  assert.notEqual(restored?.labelSi, curtailed?.labelSi);
  assert.equal(
    getMapAlarms(state).some(
      (alarm) => alarm.kind === "shedding" && alarm.targetIds.includes("D1"),
    ),
    false,
  );
});

test("presentation helpers do not mutate simulation snapshots or prior cue state", () => {
  const state = createState();
  notice(state, "L1 tripped: fault.", "critical", "L1");
  const before = structuredClone(state);
  const previous: MapCueTimeline = { lastEventId: 1, cues: [] };
  updateMapCueTimeline(previous, state, 500);
  getMapAlarms(state);
  assert.deepEqual(state, before);
  assert.deepEqual(previous, { lastEventId: 1, cues: [] });
});
