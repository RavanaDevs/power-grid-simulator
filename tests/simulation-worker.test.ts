import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";

type Snapshot = {
  paused: boolean;
  finished: boolean;
  time: number;
  target: number;
};
type Request =
  | { type: "pause" }
  | { type: "target"; value: number }
  | { type: "restore"; state: Snapshot | null };

// Exercise the actual worker protocol without real timers or a browser worker.
// Only the engine is replaced: its numerical behavior is tested separately.
const workerCode = ts.transpileModule(
  readFileSync(
    new URL("../src/game/simulation.worker.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

function workerHarness(
  options: { finishOnStep?: number; pauseOnStep?: number } = {},
) {
  const messages: Snapshot[] = [];
  const steps: number[] = [];
  let interval: (() => void) | undefined;
  let commands = 0;
  const context = createContext({
    exports: {},
    onmessage: null,
    require(name: string) {
      assert.equal(name, "./engine");
      return {
        createState: (): Snapshot => ({
          paused: true,
          finished: false,
          time: 28800,
          target: 0,
        }),
        validSave: (value: Snapshot | null) =>
          value !== null && typeof value.paused === "boolean",
        command(state: Snapshot, request: Request): Snapshot {
          commands++;
          if (request.type === "pause")
            return { ...state, paused: !state.paused };
          if (request.type === "target")
            return { ...state, target: request.value };
          return { ...request.state!, paused: true };
        },
        step(state: Snapshot, dt: number): Snapshot {
          steps.push(dt);
          return {
            ...state,
            time: state.time + dt,
            finished: steps.length === options.finishOnStep,
            paused: steps.length === options.pauseOnStep,
          };
        },
      };
    },
    postMessage(state: Snapshot) {
      // Browser postMessage snapshots data rather than retaining a mutable ref.
      messages.push(structuredClone(state));
    },
    setInterval(callback: () => void) {
      interval = callback;
    },
  });
  runInContext(workerCode, context, { filename: "simulation.worker.js" });
  assert.ok(interval, "Worker must schedule its simulation loop");
  return {
    messages,
    steps,
    commandCount: () => commands,
    tick(count = 1) {
      for (let i = 0; i < count; i++) interval!();
    },
    send(request: Request) {
      context.onmessage({ data: request });
    },
  };
}

test("paused worker publishes once at startup and sends no duplicate interval snapshots", () => {
  const worker = workerHarness();
  assert.equal(worker.messages.length, 1);
  assert.equal(worker.messages[0].paused, true);
  worker.tick(40);
  assert.equal(worker.messages.length, 1);
  assert.equal(worker.steps.length, 0);
});

test("commands publish immediately while paused or running; interval telemetry stays throttled", () => {
  const worker = workerHarness();
  worker.send({ type: "target", value: 125 });
  assert.equal(worker.messages.length, 2);
  assert.equal(worker.messages.at(-1)!.target, 125);
  assert.equal(worker.steps.length, 0);
  worker.send({ type: "pause" });
  assert.equal(worker.messages.length, 3);
  assert.equal(worker.messages.at(-1)!.paused, false);
  worker.tick(3);
  assert.equal(worker.messages.length, 3);
  worker.tick();
  assert.equal(worker.messages.length, 4);
  assert.deepEqual(worker.steps, [0.05, 0.05, 0.05, 0.05]);
  worker.send({ type: "pause" });
  assert.equal(worker.messages.length, 5);
  assert.equal(worker.messages.at(-1)!.paused, true);
  worker.tick(20);
  assert.equal(worker.messages.length, 5);
  assert.equal(worker.steps.length, 4);
});

test("finished state is published immediately even between throttled telemetry ticks", () => {
  const worker = workerHarness({ finishOnStep: 2 });
  worker.send({ type: "pause" });
  worker.tick();
  assert.equal(worker.messages.length, 2);
  worker.tick();
  assert.equal(worker.messages.length, 3);
  assert.equal(worker.messages.at(-1)!.finished, true);
  assert.equal(worker.steps.length, 2);
  worker.tick(20);
  assert.equal(
    worker.messages.length,
    3,
    "Finished snapshots must not be resent indefinitely",
  );
  assert.equal(
    worker.steps.length,
    2,
    "A completed simulation must not keep stepping",
  );
});

test("an engine-triggered pause is visible immediately without waiting for a fourth tick", () => {
  const worker = workerHarness({ pauseOnStep: 1 });
  worker.send({ type: "pause" });
  worker.tick();
  assert.equal(worker.messages.length, 3);
  assert.equal(worker.messages.at(-1)!.paused, true);
  assert.equal(worker.messages.at(-1)!.finished, false);
  worker.tick(10);
  assert.equal(worker.messages.length, 3);
});

test("invalid restores are ignored and valid restores publish a paused snapshot immediately", () => {
  const worker = workerHarness();
  worker.send({ type: "restore", state: null });
  assert.equal(worker.messages.length, 1);
  assert.equal(worker.commandCount(), 0);
  worker.send({
    type: "restore",
    state: { paused: false, finished: false, time: 43200, target: 50 },
  });
  assert.equal(worker.messages.length, 2);
  assert.deepEqual(worker.messages.at(-1), {
    paused: true,
    finished: false,
    time: 43200,
    target: 50,
  });
  worker.tick(10);
  assert.equal(worker.messages.length, 2);
});
