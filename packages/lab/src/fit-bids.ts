/**
 * Trains the bid network (`bidNet.ts`): records every bid of many auctions bid by `--bot` in all
 * four seats, then fits a small network to predict each bid from the five cards and the auction
 * so far (softmax over the legal actions, cross-entropy, Adam). The last `--held` deals are kept
 * out of training to check the fit. Writes the weights to `packages/engine/src/bidNetWeights.ts`.
 *
 *   pnpm --filter @belot/lab fit-bids [--deals 150000] [--bot normal] [--hidden 64] [--cache file]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";
import { BID_ACTIONS, BID_INPUTS, mulberry32, type BidNetWeights } from "@belot/engine";
import { STATE_SLOTS, type BidJob, type BidRecords } from "./bids";

const { values } = parseArgs({
  options: {
    deals: { type: "string", default: "150000" },
    held: { type: "string", default: "10000" },
    bot: { type: "string", default: "normal" },
    hidden: { type: "string", default: "64" },
    epochs: { type: "string", default: "8" },
    lr: { type: "string", default: "0.002" },
    batch: { type: "string", default: "256" },
    threads: { type: "string", default: String(availableParallelism()) },
    cache: { type: "string" },
    out: { type: "string" },
  },
});
const deals = Number(values.deals);
const held = Number(values.held);
const hidden = Number(values.hidden);
const epochs = Number(values.epochs);
const FIRST_SEED = 2_000_001;

/** Records the auctions of seeds [from, to) over worker threads, in seed order. */
async function record(from: number, to: number): Promise<BidRecords> {
  const threads = Math.max(1, Number(values.threads));
  const jobs: BidJob[] = Array.from({ length: threads }, (_, i) => ({
    bot: values.bot!,
    from: from + Math.floor(((to - from) * i) / threads),
    to: from + Math.floor(((to - from) * (i + 1)) / threads),
  }));
  const parts = await Promise.all(
    jobs.map(
      (job) =>
        new Promise<BidRecords>((resolve, reject) => {
          const worker = new Worker(new URL("./worker-boot.mjs", import.meta.url), { workerData: { module: "./bids-worker.ts" } });
          worker.once("message", (r: BidRecords) => {
            resolve(r);
            void worker.terminate();
          });
          worker.once("error", reject);
          worker.postMessage(job);
        }),
    ),
  );
  const n = parts.reduce((s, p) => s + p.actions.length, 0);
  const out: BidRecords = { hands: new Int32Array(n), states: new Uint8Array(n * STATE_SLOTS), legal: new Uint16Array(n), actions: new Uint8Array(n) };
  let k = 0;
  for (const p of parts) {
    out.hands.set(p.hands, k);
    out.states.set(p.states, k * STATE_SLOTS);
    out.legal.set(p.legal, k);
    out.actions.set(p.actions, k);
    k += p.actions.length;
  }
  return out;
}

function save(path: string, sets: BidRecords[]): void {
  const buffers = sets.flatMap((r) => [r.hands, r.states, r.legal, r.actions].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength)));
  const header = Buffer.from(JSON.stringify(sets.map((r) => r.actions.length)) + "\n");
  writeFileSync(path, Buffer.concat([header, ...buffers]));
}

function load(path: string): BidRecords[] {
  const data = readFileSync(path);
  const newline = data.indexOf(10);
  const lengths = JSON.parse(data.subarray(0, newline).toString()) as number[];
  let at = newline + 1;
  const take = <T>(make: (buf: ArrayBuffer) => T, bytes: number): T => {
    const copy = new Uint8Array(bytes);
    copy.set(data.subarray(at, at + bytes));
    at += bytes;
    return make(copy.buffer);
  };
  return lengths.map((n) => ({
    hands: take((b) => new Int32Array(b), n * 4),
    states: take((b) => new Uint8Array(b), n * STATE_SLOTS),
    legal: take((b) => new Uint16Array(b), n * 2),
    actions: take((b) => new Uint8Array(b), n),
  }));
}

const started = performance.now();
let trainSet: BidRecords;
let testSet: BidRecords;
if (values.cache && existsSync(values.cache)) {
  [trainSet, testSet] = load(values.cache) as [BidRecords, BidRecords];
  console.log(`loaded ${values.cache}`);
} else {
  trainSet = await record(FIRST_SEED, FIRST_SEED + deals);
  testSet = await record(FIRST_SEED + deals, FIRST_SEED + deals + held);
  if (values.cache) save(values.cache, [trainSet, testSet]);
  console.log(`recorded ${deals + held} auctions in ${((performance.now() - started) / 1000).toFixed(0)}s`);
}
console.log(`${trainSet.actions.length} training bids, ${testSet.actions.length} held out`);

/** The active input slots of row `i`: its cards and state inputs. */
function inputsOf(r: BidRecords, i: number): number[] {
  const on: number[] = [];
  for (let m = r.hands[i]!; m !== 0; m &= m - 1) on.push(31 - Math.clz32(m & -m));
  for (let k = 0; k < STATE_SLOTS; k++) {
    const s = r.states[i * STATE_SLOTS + k]!;
    if (s !== 255) on.push(s);
  }
  return on;
}

const A = BID_ACTIONS;
const size = BID_INPUTS * hidden + hidden + hidden * A + A;
const W1 = 0;
const B1 = BID_INPUTS * hidden;
const W2 = B1 + hidden;
const B2 = W2 + hidden * A;
const params = new Float64Array(size);
const rand = mulberry32(23);
for (let i = 0; i < BID_INPUTS * hidden; i++) params[W1 + i] = (rand() * 2 - 1) * 0.4;
for (let j = 0; j < hidden; j++) params[B1 + j] = 0.1;
for (let i = 0; i < hidden * A; i++) params[W2 + i] = (rand() * 2 - 1) * Math.sqrt(6 / (hidden + A));

const act = new Float64Array(hidden);
const logits = new Float64Array(A);
const probs = new Float64Array(A);

/** Forward pass for one row: fills `act` and `probs`, returns the log-probability of the taken action. */
function forward(on: readonly number[], legal: number, action: number): number {
  for (let j = 0; j < hidden; j++) {
    let a = params[B1 + j]!;
    for (const i of on) a += params[W1 + i * hidden + j]!;
    act[j] = a > 0 ? a : 0;
  }
  let max = -Infinity;
  for (let k = 0; k < A; k++) {
    if (!(legal & (1 << k))) {
      logits[k] = -Infinity;
      continue;
    }
    let z = params[B2 + k]!;
    for (let j = 0; j < hidden; j++) if (act[j]! > 0) z += act[j]! * params[W2 + j * A + k]!;
    logits[k] = z;
    if (z > max) max = z;
  }
  let sum = 0;
  for (let k = 0; k < A; k++) {
    probs[k] = legal & (1 << k) ? Math.exp(logits[k]! - max) : 0;
    sum += probs[k]!;
  }
  for (let k = 0; k < A; k++) probs[k]! /= sum;
  return Math.log(probs[action]!);
}

function evaluate(r: BidRecords): { nll: number; accuracy: number } {
  let nll = 0;
  let right = 0;
  for (let i = 0; i < r.actions.length; i++) {
    nll -= forward(inputsOf(r, i), r.legal[i]!, r.actions[i]!);
    let best = 0;
    for (let k = 1; k < A; k++) if (probs[k]! > probs[best]!) best = k;
    if (best === r.actions[i]) right++;
  }
  return { nll: nll / r.actions.length, accuracy: right / r.actions.length };
}

const n = trainSet.actions.length;
const inputs = Array.from({ length: n }, (_, i) => inputsOf(trainSet, i));
const grad = new Float64Array(size);
const m1 = new Float64Array(size);
const m2 = new Float64Array(size);
const order = Array.from({ length: n }, (_, i) => i);
const batch = Number(values.batch);
let step = 0;

for (let epoch = 0; epoch < epochs; epoch++) {
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const lr = Number(values.lr) * (epoch < epochs - 2 ? 1 : 0.3);
  let loss = 0;
  for (let start = 0; start < n; start += batch) {
    grad.fill(0);
    const end = Math.min(n, start + batch);
    const scale = 1 / (end - start);
    for (let b = start; b < end; b++) {
      const row = order[b]!;
      const on = inputs[row]!;
      const action = trainSet.actions[row]!;
      loss -= forward(on, trainSet.legal[row]!, action);
      for (let k = 0; k < A; k++) {
        if (probs[k] === 0 && k !== action) continue;
        const d = (probs[k]! - (k === action ? 1 : 0)) * scale;
        grad[B2 + k]! += d;
        for (let j = 0; j < hidden; j++) {
          if (act[j] === 0) continue;
          grad[W2 + j * A + k]! += d * act[j]!;
        }
      }
      for (let j = 0; j < hidden; j++) {
        if (act[j] === 0) continue;
        let dh = 0;
        for (let k = 0; k < A; k++) dh += (probs[k]! - (k === action ? 1 : 0)) * params[W2 + j * A + k]!;
        dh *= scale;
        grad[B1 + j]! += dh;
        for (const i of on) grad[W1 + i * hidden + j]! += dh;
      }
    }
    step++;
    const c1 = 1 - 0.9 ** step;
    const c2 = 1 - 0.999 ** step;
    for (let i = 0; i < size; i++) {
      const g = grad[i]!;
      m1[i] = 0.9 * m1[i]! + 0.1 * g;
      m2[i] = 0.999 * m2[i]! + 0.001 * g * g;
      params[i]! -= (lr * (m1[i]! / c1)) / (Math.sqrt(m2[i]! / c2) + 1e-8);
    }
  }
  const t = evaluate(testSet);
  console.log(`epoch ${epoch + 1}: train loss ${(loss / n).toFixed(4)}, held out loss ${t.nll.toFixed(4)}, accuracy ${(t.accuracy * 100).toFixed(1)}%`);
}

// Baseline: always the most common action among the legal ones.
const counts = new Array<number>(A).fill(0);
for (const a of trainSet.actions) counts[a]!++;
let right = 0;
for (let i = 0; i < testSet.actions.length; i++) {
  let best = -1;
  for (let k = 0; k < A; k++) if (testSet.legal[i]! & (1 << k) && (best < 0 || counts[k]! > counts[best]!)) best = k;
  if (best === testSet.actions[i]) right++;
}
console.log(`baseline (most common legal action): accuracy ${((right / testSet.actions.length) * 100).toFixed(1)}%`);

const round = (x: number) => Math.round(x * 10000) / 10000;
const net: BidNetWeights = {
  hidden,
  w1: Array.from(params.subarray(W1, B1), round),
  b1: Array.from(params.subarray(B1, W2), round),
  w2: Array.from(params.subarray(W2, B2), round),
  b2: Array.from(params.subarray(B2, size), round),
};
const out = values.out ?? new URL("../../engine/src/bidNetWeights.ts", import.meta.url).pathname;
const list = (xs: readonly number[]) => `[${xs.join(", ")}]`;
writeFileSync(
  out,
  `import type { BidNetWeights } from "./bidNet";

/** Trained by \`pnpm --filter @belot/lab fit-bids\` on the bids of \`${values.bot}\` in ${deals} auctions (hidden ${hidden}, ${epochs} epochs); do not edit by hand. */
export const BID_NET: BidNetWeights = {
  hidden: ${hidden},
  w1: ${list(net.w1)},
  b1: ${list(net.b1)},
  w2: ${list(net.w2)},
  b2: ${list(net.b2)},
};
`,
);
console.log(`wrote ${out}`);
