import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  step,
  command,
  powerFlow,
  validSave,
  forecastAt,
  refreshNetwork,
} from "../src/game/engine";
test("DC flow conserves injection in a balanced connected network", () => {
  const s = createState();
  const injections = [900, -100, -80, -120, -100, -50, -75, -80, -100, -195];
  powerFlow(injections, s.lines);
  for (let bus = 0; bus < 10; bus++) {
    const net = s.lines.reduce(
      (v, l) => v + (l.from === bus ? l.flow : l.to === bus ? -l.flow : 0),
      0,
    );
    assert.ok(Math.abs(net - injections[bus]) < 1e-8);
  }
});
test("open circuits carry no flow and isolated buses are detected", () => {
  const s = createState();
  s.lines
    .filter((l) => l.from === 3 || l.to === 3)
    .forEach((l) => (l.online = false));
  const groups = powerFlow([300, -100, -80, -120, 0, 0, 0, 0, 0, 0], s.lines);
  assert.equal(groups.length, 2);
  assert.ok(groups.some((g) => g.length === 1 && g[0] === 3));
  assert.ok(s.lines.filter((l) => !l.online).every((l) => l.flow === 0));
});
test("pause freezes time and dispatch obeys capacity and ramp limits", () => {
  let s = createState();
  step(s, 1);
  assert.equal(s.time, 28800);
  s = command(s, { type: "target", id: "G1", value: 9000 });
  assert.equal(s.assets[0].target, 900);
  const previous = s.assets[0].output;
  s.paused = false;
  step(s, 1);
  assert.ok(Math.abs(s.assets[0].output - previous - 12) < 1e-8);
});
test("battery cannot discharge more than its stored energy", () => {
  const s = createState();
  s.paused = false;
  s.battery = 0.1;
  s.assets.find((a) => a.id === "B1")!.target = 150;
  step(s, 1);
  assert.equal(s.battery, 0);
  assert.ok(s.assets.find((a) => a.id === "B1")!.output <= 2.51);
  step(s, 1);
  assert.equal(s.assets.find((a) => a.id === "B1")!.output, 0);
});
test("storm trips a circuit once and slows simulation", () => {
  const s = createState();
  s.time = 13 * 3600 - 1;
  s.paused = false;
  s.speed = 10;
  step(s, 0.05);
  assert.equal(s.storm, true);
  assert.equal(s.lines[3].online, false);
  assert.equal(s.speed, 1);
  const count = s.events.length;
  step(s, 0.05);
  assert.equal(s.events.length, count);
});
test("sustained overload trips a line, upgrade costs money", () => {
  const s = createState();
  s.paused = false;
  s.lines[0].capacity = 1;
  for (let i = 0; i < 30; i++) step(s, 0.05);
  assert.equal(s.lines[0].online, false);
  const cash = s.money;
  command(s, { type: "upgrade", id: "L1" });
  assert.equal(s.money, cash - 25000000);
  assert.equal(s.lines[0].capacity, 201);
});
test("versioned saves reject invalid topology and restore paused", () => {
  const s = createState();
  assert.ok(validSave(s));
  assert.ok(!validSave({ version: 1 }));
  s.lines[0].from = 99;
  assert.ok(!validSave(s));
  const good = createState();
  good.paused = false;
  assert.equal(command(s, { type: "restore", state: good }).paused, true);
});
test("an unattended shift reaches a finite failure state", () => {
  const s = createState();
  s.paused = false;
  for (let i = 0; i < 144001 && !s.finished; i++) step(s, 0.05);
  assert.ok(s.finished);
  assert.equal(s.outcome, "blackout");
  assert.ok(s.time <= 32 * 3600);
  assert.ok(Number.isFinite(s.frequency));
  assert.ok(Number.isFinite(s.money));
  assert.ok(s.reliability >= 0 && s.reliability <= 100);
});

test("breaker telemetry updates immediately while paused", () => {
  const s = createState();
  assert.notEqual(s.lines[3].flow, 0);
  command(s, { type: "toggle", id: "L4" });
  assert.equal(s.lines[3].flow, 0);
  assert.equal(s.time, 28800);
});

test("frequency protection trips generators after a sustained excursion", () => {
  const s = createState();
  s.paused = false;
  for (const a of s.assets) {
    if (!["load", "bus", "battery"].includes(a.kind)) {
      a.output = a.capacity;
      a.target = a.capacity;
    }
  }
  for (let i = 0; i < 400 && !s.finished; i++) step(s, 0.05);
  assert.ok(s.assets.some((a) => a.tripReason?.includes("overfrequency")));
  assert.ok(s.events.some((e) => e.text.includes("Frequency ")));
});
test("underfrequency sheds demand automatically before total collapse", () => {
  const s = createState();
  s.paused = false;
  s.assets[0].online = false;
  s.assets[2].online = false;
  s.assets[1].output = 40;
  s.assets[1].target = 40;
  for (let i = 0; i < 200; i++) step(s, 0.05);
  assert.ok(s.assets.some((a) => (a.autoShed ?? 0) > 0));
  assert.ok(s.events.some((e) => e.text.includes("Automatic underfrequency")));
});
test("disconnected city receives no phantom supply and has its own frequency", () => {
  const s = createState();
  s.paused = false;
  for (const l of s.lines) if (l.to === 4 || l.from === 4) l.online = false;
  for (let i = 0; i < 40; i++) step(s, 0.05);
  assert.equal(s.assets.find((a) => a.id === "D4")!.served, 0);
  assert.equal(s.busFrequency[4], 0);
  assert.equal(s.assets.find((a) => a.id === "S5")!.online, false);
  assert.ok(s.busFrequency[4] < s.busFrequency[0]);
  assert.ok(
    s.frequency > 45,
    "An isolated dead bus must not replace live-grid frequency",
  );
  assert.ok(s.lines.filter((l) => !l.online).every((l) => l.flow === 0));
});
test("a dead grid reports no frequency even with an online charging battery", () => {
  const s = createState();
  for (const a of s.assets)
    if (["coal", "solar", "hydro", "oil", "wind"].includes(a.kind)) {
      a.online = false;
      a.output = 0;
    }
  const battery = s.assets.find((a) => a.id === "B1")!;
  battery.output = -100;
  battery.target = -100;
  refreshNetwork(s, 0);
  assert.equal(s.frequency, 0);
  assert.ok(s.busFrequency.every((f) => f === 0));
  assert.ok(s.assets.filter((a) => a.kind === "bus").every((a) => !a.online));
  s.paused = false;
  step(s, 1);
  assert.equal(
    s.frequencyAlarm,
    false,
    "An absent waveform is not a frequency excursion",
  );
  assert.ok(s.blackoutTimer > 0, "Supply-loss protection still runs");
});
test("cascade scenario redistributes flow and trips successive lines", () => {
  const s = createState("normal", "cascade");
  s.paused = false;
  for (let i = 0; i < 7000 && !s.finished; i++) step(s, 0.05);
  const thermal = s.events.filter((e) => e.text.includes("thermal overload"));
  assert.ok(thermal.length >= 2, JSON.stringify(s.events));
  assert.ok(s.events.some((e) => e.text.includes("corridor fault")));
});
test("relay lockout blocks immediate reclosing even while paused", () => {
  const s = createState();
  s.time = 13 * 3600;
  s.paused = false;
  step(s, 0.05);
  s.paused = true;
  command(s, { type: "toggle", id: "L4" });
  assert.equal(s.lines[3].online, false);
  const remaining = s.lines[3].lockout;
  step(s, 20);
  assert.equal(s.lines[3].lockout, remaining);
  s.paused = false;
  for (let i = 0; i < 170; i++) step(s, 0.05);
  command(s, { type: "toggle", id: "L4" });
  assert.equal(s.lines[3].online, true);
});
test("battery cannot charge from an unpowered island", () => {
  const s = createState();
  s.paused = false;
  for (const a of s.assets)
    if (["coal", "solar", "hydro", "oil", "wind"].includes(a.kind))
      a.online = false;
  s.assets.find((a) => a.kind === "battery")!.target = -150;
  const energy = s.battery;
  step(s, 1);
  assert.equal(s.battery, energy);
});
test("sustained large loss of supply ends the mission as a blackout", () => {
  const s = createState();
  s.paused = false;
  for (const a of s.assets)
    if (["coal", "solar", "hydro", "oil", "wind"].includes(a.kind))
      a.online = false;
  for (let i = 0; i < 520; i++) step(s, 0.05);
  assert.equal(s.outcome, "blackout");
  assert.equal(s.finished, true);
  assert.equal(s.paused, true);
});
test("brief overload exposure cools instead of tripping immediately", () => {
  const s = createState();
  s.paused = false;
  s.lines[0].capacity = 80;
  step(s, 0.1);
  assert.equal(s.lines[0].online, true);
  const heat = s.lines[0].heat;
  assert.ok(heat > 0);
  s.lines[0].capacity = 360;
  step(s, 1);
  assert.ok(s.lines[0].heat < heat);
  assert.equal(s.lines[0].online, true);
});

test("incompatible maps and corrupt resource saves are rejected", () => {
  const old = { ...createState(), version: 1 };
  assert.equal(validSave(old), false);
  const s = createState();
  s.assets[0].lockout = NaN;
  assert.equal(validSave(s), false);
  const hydro = createState();
  delete hydro.assets.find((a) => a.kind === "hydro")!.inflow;
  assert.equal(validSave(hydro), false);
});

test("load rejection trips overfrequency protection and preserves the initiating cause", () => {
  const s = createState("normal", "load-rejection");
  s.time = 37799;
  s.paused = false;
  for (let i = 0; i < 800 && !s.finished; i++) step(s, 0.05);
  assert.equal(s.outcome, "blackout");
  assert.equal(s.failureCause, "Overfrequency cascade");
  assert.ok(s.events.some((e) => e.text.includes("tripped: overfrequency")));
  assert.equal(s.generation, 0);
  assert.ok(s.lines.every((l) => !l.online));
});
test("finite hydro water bounds output, withdrawal, and inflow", () => {
  const s = createState();
  s.paused = false;
  const a = s.assets.find((a) => a.id === "G2")!;
  a.water = 0.000001;
  a.inflow = 0;
  a.target = a.capacity;
  step(s, 0.1);
  assert.equal(a.water, 0);
  assert.equal(a.output, 0);
  assert.ok(s.waterUsed > 0);
  assert.ok(
    s.assets
      .filter((a) => a.kind === "hydro")
      .every((a) => a.water! >= 0 && a.water! <= a.waterMax!),
  );
});
test("cash ledger accounts for fuel, environmental impact, lost energy and upgrades", () => {
  const s = createState();
  s.paused = false;
  step(s, 2);
  command(s, { type: "upgrade", id: "L1" });
  const expected =
    450e6 +
    s.revenue -
    s.fuelCost -
    s.environmentCost -
    s.outageCost -
    s.upgradeCost;
  assert.ok(Math.abs(s.money - expected) < 0.001);
  assert.ok(s.emissions > 0);
  assert.ok(s.waterUsed > 0);
  assert.ok(s.environmentCost > 0);
});
test("forecast plan is separate from targets and actual telemetry", () => {
  const s = createState();
  const before = forecastAt(s, s.time + 3600).generation;
  command(s, { type: "target", id: "G1", value: 0 });
  assert.equal(forecastAt(s, s.time + 3600).generation, before);
  command(s, { type: "plan" });
  assert.ok(forecastAt(s, s.time + 3600).generation < before);
  s.paused = false;
  step(s, 16);
  assert.ok(s.history.length > 1);
  assert.ok(s.history.every((p) => p.time <= s.time));
});
test("dry season starts with less usable reservoir energy", () => {
  const wet = createState(),
    dry = createState("normal", "dry-season");
  assert.equal(
    dry.assets.find((a) => a.id === "G2")!.water,
    wet.assets.find((a) => a.id === "G2")!.water! * 0.25,
  );
});
test("a balanced near-complete shift finishes successfully", () => {
  const s = createState();
  s.time = 115199;
  s.storm = true;
  s.paused = false;
  refreshNetwork(s, 0);
  step(s, 0.2);
  assert.equal(s.outcome, "completed");
  assert.equal(s.time, 115200);
});

test("normal clock advances twelve grid seconds per real second, speed and pause apply", () => {
  const s = createState();
  s.paused = false;
  step(s, 1);
  assert.ok(Math.abs(s.time - 28812) < 1e-6);
  command(s, { type: "speed", value: 5 });
  step(s, 1);
  assert.ok(Math.abs(s.time - 28872) < 1e-6);
  command(s, { type: "pause" });
  step(s, 10);
  assert.ok(Math.abs(s.time - 28872) < 1e-6);
});
test("black start stays dark without a phantom frequency or immediate mission failure", () => {
  const s = createState("normal", "black-start");
  s.paused = false;
  step(s, 30);
  assert.equal(s.finished, false);
  assert.equal(s.frequency, 0);
  assert.equal(s.generation, 0);
  assert.equal(s.unserved, s.demand);
  assert.ok(s.busFrequency.every((f) => f === 0));
  assert.ok(s.lines.every((l) => !l.online));
  assert.equal(validSave(s), true);
  s.assets.find((a) => a.id === "D1")!.pickup = 2;
  assert.equal(validSave(s), false);
});
test("restoration enforces auxiliaries, live-bus startup and staged pickup", () => {
  const s = createState("normal", "black-start");
  const hydro = s.assets.find((a) => a.id === "G4")!,
    coal = s.assets[0],
    load = s.assets.find((a) => a.id === "D2")!;
  command(s, { type: "toggle", id: "G4" });
  command(s, { type: "toggle", id: "G1" });
  command(s, { type: "toggle", id: "L1" });
  command(s, { type: "pickup", id: "D2", value: 0.1 });
  assert.ok(
    !hydro.starting && !coal.starting && !s.lines[0].online && !load.pickup,
  );
  command(s, { type: "auxiliary" });
  assert.equal(s.battery, 318);
  command(s, { type: "auxiliary" });
  assert.equal(s.battery, 318);
  command(s, { type: "toggle", id: "G4" });
  assert.equal(hydro.starting, 8);
  s.paused = false;
  step(s, 9);
  assert.equal(hydro.online, true);
  assert.equal(s.busFrequency[1], 50);
  command(s, { type: "pickup", id: "D2", value: 1 });
  assert.equal(load.pickup, 0);
  command(s, { type: "pickup", id: "D2", value: 0.1 });
  assert.equal(load.pickup, 0.1);
  step(s, 10);
  assert.ok(load.served! > 0);
  assert.equal(s.outcome, "running");
});
test("live island frequency mismatch blocks restoration breaker closure", () => {
  const s = createState("normal", "black-start");
  s.busFrequency[0] = 49.8;
  s.busFrequency[1] = 50.2;
  command(s, { type: "toggle", id: "L1" });
  assert.equal(s.lines[0].online, false);
});
test("complete black-start sequence can restore every community and finish", () => {
  const s = createState("normal", "black-start");
  s.paused = false;
  command(s, { type: "auxiliary" });
  command(s, { type: "toggle", id: "G4" });
  step(s, 9);
  for (let j = 0; j < 10; j++)
    for (const l of s.lines)
      if (!l.online) command(s, { type: "toggle", id: l.id });
  for (const a of s.assets.filter(
    (a) => !["bus", "load", "battery"].includes(a.kind),
  )) {
    command(s, { type: "target", id: a.id, value: a.capacity });
    if (!a.online) command(s, { type: "toggle", id: a.id });
  }
  step(s, 35);
  for (let round = 0; round < 25 && !s.finished; round++)
    for (const a of s.assets.filter(
      (a) => a.kind === "load" && (a.pickup ?? 0) < 0.999,
    )) {
      command(s, {
        type: "pickup",
        id: a.id,
        value: Math.min(1, (a.pickup ?? 0) + 0.1),
      });
      step(s, 10);
    }
  step(s, 30);
  assert.equal(s.outcome, "completed");
  assert.ok(s.restoration!.stable >= 20);
  assert.ok(s.unserved < s.demand * 0.05);
  assert.equal(validSave(s), true);
});
test("black-start deadline cannot count an unrestored island as a success", () => {
  const s = createState("normal", "black-start");
  s.time = 115199;
  s.paused = false;
  step(s, 0.2);
  assert.equal(s.outcome, "blackout");
  assert.equal(s.failureCause, "Restoration deadline missed");
  assert.equal(validSave(s), true);
});
test("loss of cranking supply aborts a non-black-start generator", () => {
  const s = createState("normal", "black-start");
  command(s, { type: "auxiliary" });
  command(s, { type: "toggle", id: "G4" });
  s.paused = false;
  step(s, 9);
  command(s, { type: "toggle", id: "L1" });
  command(s, { type: "toggle", id: "G1" });
  assert.equal(s.assets[0].starting, 30);
  command(s, { type: "toggle", id: "L1" });
  step(s, 0.1);
  assert.equal(s.assets[0].starting, 0);
  assert.equal(s.assets[0].online, false);
});
