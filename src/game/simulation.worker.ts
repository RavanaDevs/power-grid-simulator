import { createState, command, step, validSave, type Command } from "./engine";
let state = createState();
onmessage = (event: MessageEvent<Command>) => {
  if (event.data.type === "restore" && !validSave(event.data.state)) return;
  state = command(state, event.data);
  postMessage(state);
};
let ticks = 0;
setInterval(() => {
  // Commands publish immediately; a paused map needs no duplicate snapshots.
  if (state.paused || state.finished) return;
  state = step(state, 0.05);
  if (++ticks % 4 === 0 || state.paused || state.finished) postMessage(state);
}, 50);
postMessage(state);
