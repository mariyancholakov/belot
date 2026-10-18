import { useCallback, useState } from "react";

/**
 * All sounds are synthesized with WebAudio: no files to load, nothing to license.
 * They imitate a card table covered in felt: card edges ticking softly, cards sliding, a riffle
 * shuffle, fingertips tapping the cloth. Sound can be switched off; the choice is remembered.
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

/** The shared audio context, or null while sound is off. The spoken calls (`voice.ts`) play through it too. */
export function audio(): { ctx: AudioContext; master: GainNode } | null {
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
    soften.frequency.value = 6200;
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

/** The soft tick of a card edge landing on felt: short, a little dull, never sharp. */
function click(a: A, at: number, gain: number, freq = 2400): void {
  noiseHit(a, { at, dur: jitter(0.022, 0.3), from: jitter(Math.min(freq, 2800)), q: 0.8, gain: jitter(gain * 0.8, 0.15) });
  noiseHit(a, { at, dur: 0.012, from: jitter(1300), q: 0.6, gain: gain * 0.5, type: "lowpass" });
}

/** Cards sliding over felt or paper: soft, airy, no hard edge. */
function slide(a: A, at: number, dur: number, gain: number, from = 5200, to = 2200): void {
  noiseHit(a, { at, attack: dur * 0.35, dur, from: jitter(from), to: jitter(to), q: 0.6, gain: jitter(gain, 0.15) });
}

/** The muffled body of the felt under a card: filtered noise only, no pitched thud (that sounds like wood). */
function thump(a: A, at: number, gain: number, freq = 130): void {
  noiseHit(a, { at, dur: 0.07, from: jitter(freq * 3), q: 0.4, gain: gain * 0.9, type: "lowpass" });
}

/** A fingertip tapping the felt: padded and short. */
function knock(a: A, at: number, gain: number): void {
  thump(a, at, gain * 0.8, 150);
  click(a, at, gain * 0.5, 1800);
}

/** A card thrown down on the table: whoosh, then edge click and table thud. */
function cardDown(a: A, at: number, gain = 1): void {
  slide(a, at, 0.09, 0.2 * gain, 5200, 2400);
  click(a, at + 0.07, 0.4 * gain, 2300);
  thump(a, at + 0.072, 0.3 * gain);
}

/** One card flicked across the table to a player. */
function flick(a: A, at: number, gain = 1): void {
  slide(a, at, 0.1, 0.2 * gain, 6500, 3200);
  click(a, at + 0.085, 0.2 * gain, 2200);
}

/** A riffle: two halves of the deck released alternately under the thumbs. */
function riffle(a: A, at: number, clicks = 34): number {
  let t = at;
  slide(a, t, 0.18, 0.1, 3500, 6000); // the halves pushing together
  t += 0.12;
  for (let i = 0; i < clicks; i++) {
    const progress = i / clicks;
    click(a, t, 0.15 + 0.1 * Math.sin(progress * Math.PI), 2200 + Math.random() * 900);
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
  /** A packet of cards slid across to a player: a light slide while it flies, then a soft settle as it lands (DEAL_FLY). */
  dealPacket(a: A) {
    slide(a, 0, 0.3, 0.13, 5200, 2400);
    thump(a, 0.41, 0.2);
    click(a, 0.41, 0.15, 2100);
    click(a, 0.435, 0.09, 1800);
  },
  /** Riffle shuffle, bridge, then squaring up the deck. */
  shuffle(a: A) {
    const end = riffle(a, 0);
    // Bridge: the cards spring down in a quick cascade.
    for (let i = 0; i < 12; i++) click(a, end + 0.04 + i * 0.022, 0.12 + Math.random() * 0.06, 2000 + Math.random() * 800);
    // Square the deck against the table.
    const done = end + 0.4;
    thump(a, done, 0.3);
    click(a, done, 0.25, 2000);
    thump(a, done + 0.12, 0.22);
    click(a, done + 0.12, 0.18, 1900);
  },
  /** A trick being gathered up and slid to its winner. */
  trick(a: A) {
    slide(a, 0, 0.26, 0.14, 4200, 1600);
    click(a, 0.04, 0.12, 2400);
    click(a, 0.1, 0.1, 2000);
    click(a, 0.17, 0.09, 1800);
  },
  /** It is your turn: a card sliding and a light tap on the felt. */
  turn(a: A) {
    slide(a, 0, 0.12, 0.08, 4200, 2200);
    knock(a, 0.09, 0.2);
  },
  /** A bid: a card laid down and a soft tap. */
  bid(a: A) {
    slide(a, 0, 0.1, 0.12, 4800, 2400);
    knock(a, 0.08, 0.4);
  },
  /** A pass: the double tap players give the felt. */
  pass(a: A) {
    knock(a, 0, 0.24);
    knock(a, 0.12, 0.2);
  },
  /** Contra: a double tap, the second one firmer. */
  contra(a: A) {
    slide(a, 0, 0.1, 0.12, 4800, 2400);
    knock(a, 0.08, 0.4);
    knock(a, 0.22, 0.46);
  },
  /** Belot: two quick flicks and a bright snap. */
  belot(a: A) {
    flick(a, 0, 0.8);
    flick(a, 0.12, 0.8);
    click(a, 0.24, 0.3, 2800);
  },
  /** A round or game won: cards cascading in the hand. */
  win(a: A) {
    for (let i = 0; i < 18; i++) click(a, i * 0.026, 0.14 + 0.1 * (i / 18), 2000 + i * 40);
    thump(a, 0.52, 0.28);
  },
  /** A round or game lost: one heavy slide and a thud. */
  lose(a: A) {
    slide(a, 0, 0.3, 0.2, 2800, 900);
    thump(a, 0.3, 0.32, 100);
  },
  /** A button press. */
  tap(a: A) {
    click(a, 0, 0.35, 2000);
    thump(a, 0, 0.18, 160);
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
