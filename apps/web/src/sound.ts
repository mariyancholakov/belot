import { useCallback, useState } from "react";

/**
 * All sounds are synthesized with WebAudio: no files to load, nothing to license.
 * Sound can be switched off; the choice is remembered.
 */
const KEY = "belot.sound";
const VOLUME = 0.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let enabled = readEnabled();

function readEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (!enabled) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, master: master! };
}

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

interface BurstOptions {
  at?: number;
  dur: number;
  from: number;
  to?: number;
  q?: number;
  gain: number;
  type?: BiquadFilterType;
}

/** A filtered burst of noise: card flicks, swishes, paper. */
function burst(a: { ctx: AudioContext; master: GainNode }, o: BurstOptions): void {
  const t = a.ctx.currentTime + (o.at ?? 0);
  const src = a.ctx.createBufferSource();
  src.buffer = noise(a.ctx);
  const filter = a.ctx.createBiquadFilter();
  filter.type = o.type ?? "bandpass";
  filter.Q.value = o.q ?? 1.2;
  filter.frequency.setValueAtTime(o.from, t);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(filter).connect(g).connect(a.master);
  src.start(t, Math.random() * 0.2);
  src.stop(t + o.dur + 0.02);
}

interface ToneOptions {
  at?: number;
  dur: number;
  freq: number;
  to?: number;
  gain: number;
  type?: OscillatorType;
}

function tone(a: { ctx: AudioContext; master: GainNode }, o: ToneOptions): void {
  const t = a.ctx.currentTime + (o.at ?? 0);
  const osc = a.ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(a.master);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

const recipes = {
  /** A card landing on the table. */
  play(a: Parameters<typeof burst>[0]) {
    burst(a, { dur: 0.07, from: 3200, to: 1400, q: 0.9, gain: 0.5 });
    tone(a, { dur: 0.09, freq: 150, to: 70, gain: 0.35 });
  },
  /** Cards being dealt: a quick riffle of flicks. */
  deal(a: Parameters<typeof burst>[0]) {
    for (let i = 0; i < 6; i++) burst(a, { at: i * 0.06, dur: 0.045, from: 3800, to: 2200, q: 1.4, gain: 0.28 });
  },
  /** A trick being swept to its winner. */
  trick(a: Parameters<typeof burst>[0]) {
    burst(a, { dur: 0.26, from: 1400, to: 500, q: 0.7, gain: 0.3 });
    tone(a, { at: 0.18, dur: 0.12, freq: 320, to: 260, gain: 0.12 });
  },
  /** It is your turn. */
  turn(a: Parameters<typeof burst>[0]) {
    tone(a, { dur: 0.16, freq: 659, gain: 0.16, type: "triangle" });
    tone(a, { at: 0.09, dur: 0.22, freq: 880, gain: 0.16, type: "triangle" });
  },
  bid(a: Parameters<typeof burst>[0]) {
    tone(a, { dur: 0.1, freq: 520, to: 600, gain: 0.2, type: "triangle" });
  },
  pass(a: Parameters<typeof burst>[0]) {
    tone(a, { dur: 0.12, freq: 330, to: 280, gain: 0.15, type: "triangle" });
  },
  contra(a: Parameters<typeof burst>[0]) {
    tone(a, { dur: 0.28, freq: 130, to: 80, gain: 0.3, type: "sawtooth" });
    burst(a, { dur: 0.2, from: 500, q: 0.8, gain: 0.25, type: "lowpass" });
  },
  belot(a: Parameters<typeof burst>[0]) {
    [988, 1319, 1760].forEach((f, i) => tone(a, { at: i * 0.07, dur: 0.3, freq: f, gain: 0.14, type: "triangle" }));
  },
  win(a: Parameters<typeof burst>[0]) {
    [523, 659, 784, 1047].forEach((f, i) => tone(a, { at: i * 0.1, dur: 0.4, freq: f, gain: 0.16, type: "triangle" }));
  },
  lose(a: Parameters<typeof burst>[0]) {
    [392, 330, 262].forEach((f, i) => tone(a, { at: i * 0.14, dur: 0.4, freq: f, gain: 0.14, type: "sine" }));
  },
  tap(a: Parameters<typeof burst>[0]) {
    tone(a, { dur: 0.05, freq: 700, gain: 0.1 });
  },
};

export type SoundName = keyof typeof recipes;

export function playSound(name: SoundName): void {
  const a = audio();
  if (a) recipes[name](a);
}

export function useSound() {
  const [on, setOn] = useState(enabled);
  const toggle = useCallback(() => {
    enabled = !enabled;
    try {
      localStorage.setItem(KEY, enabled ? "on" : "off");
    } catch {
      /* ignore */
    }
    setOn(enabled);
    if (enabled) playSound("tap");
  }, []);
  return { on, toggle };
}
