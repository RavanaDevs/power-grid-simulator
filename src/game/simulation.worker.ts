import { createState, command, step, validSave, type Command } from "./engine";
let state = createState();
onmessage = (event: MessageEvent<Command>) => {
  if (event.data.type === "restore" && !validSave(event.data.state)) return;
  state = command(state, event.data);
  postMessage(state);
};
let ticks = 0;
setInterval(() => {
  state = step(state, 0.05);
  if (++ticks % 4 === 0) postMessage(state);
}, 50);
postMessage(state);
