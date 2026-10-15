import { useCallback, useState } from "react";

/**
 * All sounds are synthesized with WebAudio: no files to load, nothing to license.
 * They imitate a real card table: card edges clicking, cards sliding on felt, a riffle
 * shuffle, knuckles knocking on wood. Sound can be switched off; the choice is remembered.
 */
const KEY = "belot.sound";
const VOLUME = 2;

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
    // Gently round off the digital edge and keep stacked sounds (a shuffle) from clipping.
    const soften = ctx.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = 9000;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    master.connect(soften).connect(limiter).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, master: master! };
}

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

type A = { ctx: AudioContext; master: GainNode };

/** Small random variation so repeated sounds never sound like a loop. */
const jitter = (value: number, amount = 0.12) => value * (1 + (Math.random() * 2 - 1) * amount);

interface NoiseOptions {
  at: number;
  /** Attack and total length in seconds. */
  attack?: number;
  dur: number;
  from: number;
  to?: number;
  q?: number;
  gain: number;
  type?: BiquadFilterType;
}

/** Filtered noise with an exponential decay: the basis of every sound below. */
function noiseHit(a: A, o: NoiseOptions): void {
  const t = a.ctx.currentTime + o.at;
  const attack = o.attack ?? 0.001;
  const src = a.ctx.createBufferSource();
  src.buffer = noise(a.ctx);
  const filter = a.ctx.createBiquadFilter();
  filter.type = o.type ?? "bandpass";
  filter.Q.value = o.q ?? 0.9;
  filter.frequency.setValueAtTime(o.from, t);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(o.gain, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(filter).connect(g).connect(a.master);
  src.start(t, Math.random() * 1.0);
  src.stop(t + o.dur + 0.03);
}

/** The dry click of a card edge or corner hitting something. */
function click(a: A, at: number, gain: number, freq = 3200): void {
  noiseHit(a, { at, dur: jitter(0.014, 0.3), from: jitter(freq), q: 1.1, gain: jitter(gain, 0.15) });
  noiseHit(a, { at, dur: 0.008, from: jitter(freq * 1.8), q: 0.7, gain: gain * 0.5, type: "highpass" });
}

/** Cards sliding over felt or paper: soft, airy, no hard edge. */
function slide(a: A, at: number, dur: number, gain: number, from = 5200, to = 2200): void {
  noiseHit(a, { at, attack: dur * 0.35, dur, from: jitter(from), to: jitter(to), q: 0.6, gain: jitter(gain, 0.15) });
}

/** The body of the table under a card or knuckle. */
function thump(a: A, at: number, gain: number, freq = 130): void {
  noiseHit(a, { at, dur: 0.05, from: jitter(freq * 2.2), q: 0.5, gain: gain * 0.8, type: "lowpass" });
  const t = a.ctx.currentTime + at;
  const osc = a.ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(jitter(freq), t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.07);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(g).connect(a.master);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** Wood knuckle on the table edge. */
function knock(a: A, at: number, gain: number): void {
  thump(a, at, gain, 190);
  noiseHit(a, { at, dur: 0.03, from: jitter(1400), q: 2.2, gain: gain * 0.6 });
}

/** A card thrown down on the table: whoosh, then edge click and table thud. */
function cardDown(a: A, at: number, gain = 1): void {
  slide(a, at, 0.08, 0.16 * gain, 6000, 2800);
  click(a, at + 0.06, 0.5 * gain, 3000);
  click(a, at + 0.064, 0.3 * gain, 1700);
  thump(a, at + 0.062, 0.28 * gain);
}

/** One card flicked across the table to a player. */
function flick(a: A, at: number, gain = 1): void {
  slide(a, at, 0.1, 0.2 * gain, 6500, 3200);
  click(a, at + 0.085, 0.22 * gain, 2600);
}

/** A riffle: two halves of the deck released alternately under the thumbs. */
function riffle(a: A, at: number, clicks = 34): number {
  let t = at;
  slide(a, t, 0.18, 0.1, 3500, 6000); // the halves pushing together
  t += 0.12;
  for (let i = 0; i < clicks; i++) {
    const progress = i / clicks;
    click(a, t, 0.17 + 0.1 * Math.sin(progress * Math.PI), 3600 + Math.random() * 1600);
    t += 0.046 - 0.028 * progress + Math.random() * 0.008;
  }
  return t;
}

const recipes = {
  /** A card landing on the table. */
  play(a: A) {
    cardDown(a, 0);
  },
  /** Cards being dealt: a few flicks. */
  deal(a: A) {
    for (let i = 0; i < 4; i++) flick(a, i * 0.11, 1.4);
  },
  /** One card flicked to a player (used for the deal animation). */
  dealOne(a: A) {
    flick(a, 0, 1.6);
  },
  /** A packet of cards slid across to a player. */
  dealPacket(a: A) {
    slide(a, 0, 0.16, 0.3, 6000, 2600);
    click(a, 0.13, 0.28, 2800);
    click(a, 0.155, 0.2, 2200);
    click(a, 0.18, 0.16, 3200);
    thump(a, 0.14, 0.16);
  },
  /** Riffle shuffle, bridge, then squaring up the deck. */
  shuffle(a: A) {
    const end = riffle(a, 0);
    // Bridge: the cards spring down in a quick cascade.
    for (let i = 0; i < 12; i++) click(a, end + 0.04 + i * 0.022, 0.12 + Math.random() * 0.06, 2800 + Math.random() * 1200);
    // Square the deck against the table.
    const done = end + 0.4;
    thump(a, done, 0.3);
    click(a, done, 0.3, 2400);
    thump(a, done + 0.12, 0.22);
    click(a, done + 0.12, 0.22, 2200);
  },
  /** Lift the top packet, set it down, put the bottom packet on top. */
  cut(a: A) {
    slide(a, 0, 0.16, 0.12, 3200, 1800);
    thump(a, 0.3, 0.26);
    click(a, 0.3, 0.3, 2400);
    slide(a, 0.55, 0.16, 0.12, 3200, 1800);
    thump(a, 0.78, 0.3);
    click(a, 0.78, 0.34, 2300);
    thump(a, 0.9, 0.2);
  },
  /** A trick being gathered up and slid to its winner. */
  trick(a: A) {
    slide(a, 0, 0.26, 0.14, 4200, 1600);
    click(a, 0.04, 0.12, 2400);
    click(a, 0.1, 0.1, 2000);
    click(a, 0.17, 0.09, 1800);
  },
  /** It is your turn: a light tap on the table. */
  turn(a: A) {
    knock(a, 0, 0.22);
    knock(a, 0.13, 0.17);
  },
  /** A bid: one firm knock. */
  bid(a: A) {
    knock(a, 0, 0.55);
  },
  /** A pass: the double tap players give the table. */
  pass(a: A) {
    knock(a, 0, 0.3);
    knock(a, 0.11, 0.26);
  },
  /** Contra: a hard double knock. */
  contra(a: A) {
    knock(a, 0, 0.42);
    knock(a, 0.16, 0.5);
  },
  /** Belot: two quick flicks and a bright snap. */
  belot(a: A) {
    flick(a, 0, 0.8);
    flick(a, 0.12, 0.8);
    click(a, 0.24, 0.42, 4800);
  },
  /** A round or game won: cards cascading in the hand. */
  win(a: A) {
    for (let i = 0; i < 18; i++) click(a, i * 0.026, 0.16 + 0.12 * (i / 18), 3000 + i * 90);
    thump(a, 0.52, 0.28);
  },
  /** A round or game lost: one heavy slide and a thud. */
  lose(a: A) {
    slide(a, 0, 0.3, 0.2, 2800, 900);
    thump(a, 0.3, 0.32, 100);
  },
  /** A button press. */
  tap(a: A) {
    click(a, 0, 0.5, 2600);
    thump(a, 0, 0.2, 160);
  },
};

export type SoundName = keyof typeof recipes;

/** `delayMs` lets an animation schedule sounds ahead on the audio clock. */
export function playSound(name: SoundName, delayMs = 0): void {
  const a = audio();
  if (!a) return;
  if (delayMs <= 0) return recipes[name](a);
  // Shift the whole recipe by wrapping the context clock.
  const shifted: A = { ctx: a.ctx, master: a.master };
  const offset = delayMs / 1000;
  const proxy = new Proxy(a.ctx, {
    get(target, prop) {
      if (prop === "currentTime") return target.currentTime + offset;
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
  shifted.ctx = proxy;
  recipes[name](shifted);
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
