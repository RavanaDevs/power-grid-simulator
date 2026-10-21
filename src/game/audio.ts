export type Cue =
  | "select"
  | "dispatch"
  | "breaker"
  | "upgrade"
  | "warning"
  | "trip"
  | "start"
  | "success"
  | "failure"
  | "save";
const NOTES: Record<Cue, number[]> = {
  select: [480],
  dispatch: [340, 440],
  breaker: [180, 110],
  upgrade: [440, 554, 660],
  warning: [620, 620],
  trip: [160, 120, 90],
  start: [330, 440, 660],
  success: [392, 494, 587, 784],
  failure: [330, 277, 220],
  save: [550, 740],
};
/** Synthesized locally: no downloads, autoplay, or audio assets required. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;
  private hum: OscillatorNode | null = null;
  private enabled = true;
  private volume = 0.45;
  private last = new Map<Cue, number>();
  unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.ambient = this.ctx.createGain();
        this.ambient.gain.value = 0;
        this.ambient.connect(this.master);
        this.hum = this.ctx.createOscillator();
        this.hum.type = "sine";
        this.hum.frequency.value = 60;
        this.hum.connect(this.ambient);
        this.hum.start();
      }
      void this.ctx.resume().catch(() => {});
      this.configure(this.enabled, this.volume);
    } catch {}
  }
  configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = volume;
    if (this.ctx && this.master)
      this.master.gain.setTargetAtTime(
        enabled ? volume : 0,
        this.ctx.currentTime,
        0.04,
      );
  }
  environment(running: boolean, storm: boolean) {
    if (this.ctx && this.ambient) {
      this.ambient.gain.setTargetAtTime(
        running ? 0.025 : 0,
        this.ctx.currentTime,
        0.7,
      );
      this.hum?.frequency.setTargetAtTime(
        storm ? 48 : 60,
        this.ctx.currentTime,
        0.8,
      );
    }
  }
  play(cue: Cue) {
    if (
      !this.enabled ||
      !this.ctx ||
      !this.master ||
      this.ctx.state !== "running"
    )
      return;
    const now = this.ctx.currentTime;
    if (
      now - (this.last.get(cue) ?? -100) <
      (cue === "warning" ? 6 : cue === "dispatch" ? 0.12 : 0.07)
    )
      return;
    this.last.set(cue, now);
    const ctx = this.ctx;
    NOTES[cue].forEach((frequency, i) => {
      const osc = ctx.createOscillator(),
        gain = ctx.createGain(),
        at = now + i * 0.12;
      osc.type = cue === "trip" || cue === "breaker" ? "triangle" : "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(
        cue === "trip" ? 0.2 : 0.13,
        at + 0.015,
      );
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.24);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(at);
      osc.stop(at + 0.25);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }
  dispose() {
    this.hum?.stop();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.ambient = null;
    this.hum = null;
  }
}
