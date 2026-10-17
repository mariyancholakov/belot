import { useCallback, useState } from "react";
import phrases from "./voice/phrases.json";
import { audio } from "./sound";

/**
 * Spoken calls: a voice says each bid, announcement and belot, like players at a real table.
 * The clips are recorded once with Azure's Bulgarian neural voices (`pnpm --filter @belot/web voices`)
 * and bundled with the app. One team speaks with a man's voice, the other with a woman's.
 * Calls never overlap: each waits for the one before, and a call that would come too late is dropped.
 */
export type Phrase = keyof typeof phrases;

const KEY = "belot.voice";
const VOICES = ["borislav", "kalina"] as const;
const VOLUME = 1.1;
/** A call that would start this much later than its moment is no longer worth saying. */
const MAX_LAG = 1.2;
const GAP = 0.06;

const files = import.meta.glob("./voice/*/*.mp3", { query: "?url", import: "default", eager: true }) as Record<string, string>;
const urlOf = (voice: string, phrase: Phrase) => files[`./voice/${voice}/${phrase}.mp3`];

let enabled = readEnabled();
/** A decoded clip and the part of it that is the word, without the silence the voice leaves around it. */
interface Clip {
  buffer: AudioBuffer;
  start: number;
  duration: number;
}
const buffers = new Map<string, Clip>();
const loading = new Set<string>();
let out: GainNode | null = null;
/** When the voice is free again, on the audio clock. */
let freeAt = 0;

function readEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

/** Finds where the word starts and ends: one of the voices pads its clips with up to a second of silence. */
function trim(buffer: AudioBuffer): Clip {
  const data = buffer.getChannelData(0);
  const loud = (i: number) => Math.abs(data[i]!) > 0.012;
  let first = 0;
  while (first < data.length && !loud(first)) first++;
  let last = data.length - 1;
  while (last > first && !loud(last)) last--;
  const rate = buffer.sampleRate;
  const start = Math.max(0, first / rate - 0.01);
  const end = Math.min(buffer.duration, last / rate + 0.05);
  return end > start ? { buffer, start, duration: end - start } : { buffer, start: 0, duration: buffer.duration };
}

function load(ctx: AudioContext, url: string): void {
  if (buffers.has(url) || loading.has(url)) return;
  loading.add(url);
  fetch(url)
    .then((res) => res.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => buffers.set(url, trim(buffer)))
    .catch(() => {
      /* a clip that will not load is simply not said */
    })
    .finally(() => loading.delete(url));
}

/** Fetches every clip ahead of time, so the first bid is heard on time. */
export function preloadVoice(): void {
  if (!enabled) return;
  const a = audio();
  if (!a) return;
  for (const url of Object.values(files)) load(a.ctx, url);
}

/**
 * Says `phrase` in the voice of `team`, `delayMs` from now. Returns false when nothing will be said
 * (voice or sound off, or the clip not loaded), so the caller can play its plain sound instead.
 */
export function say(phrase: Phrase, team: number, delayMs = 0): boolean {
  if (!enabled) return false;
  const a = audio();
  const url = urlOf(VOICES[team % 2]!, phrase);
  if (!a || !url) return false;
  const clip = buffers.get(url);
  if (!clip) {
    load(a.ctx, url);
    return false;
  }
  if (!out) {
    // straight to the speakers: the card sounds' soft low-pass would muffle the voice
    out = a.ctx.createGain();
    out.gain.value = VOLUME;
    out.connect(a.ctx.destination);
  }
  const want = a.ctx.currentTime + delayMs / 1000;
  const at = Math.max(want, freeAt);
  if (at - want > MAX_LAG) return false;
  const src = a.ctx.createBufferSource();
  src.buffer = clip.buffer;
  src.connect(out);
  src.start(at, clip.start, clip.duration);
  freeAt = at + clip.duration + GAP;
  return true;
}

/** Whether any clips were recorded at all; without them the voice switch is hidden. */
export const hasVoice = Object.keys(files).length > 0;

export function useVoice() {
  const [on, setOn] = useState(enabled);
  const toggle = useCallback(() => {
    enabled = !enabled;
    try {
      localStorage.setItem(KEY, enabled ? "on" : "off");
    } catch {
      /* ignore */
    }
    setOn(enabled);
    if (enabled) preloadVoice();
  }, []);
  return { on, toggle };
}
