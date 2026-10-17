/**
 * Trains the hand network (`handNet.ts`): deals many random rounds, plays every contract out (as
 * `fit-hands` does), and fits one small network per kind of contract to the bidding team's
 * margin from each seat's first five cards. Deals after the training ones are held out to compare
 * the network with the linear hand model. Writes the weights to `packages/engine/src/handNetWeights.ts`.
 *
 *   pnpm --filter @belot/lab fit-net [--deals 300000] [--hidden 32] [--epochs 6] [--rollout 0]
 */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  announcementPoints,
  cardIndex,
  handKind,
  handValue,
  mulberry32,
  NET_INPUTS,
  netInputs,
  netValue,
  playOut,
  POLICIES,
  roundResult,
  shuffledDeck,
  startRound,
  type HandKind,
  type NetWeights,
} from "@belot/engine";

const { values } = parseArgs({
  options: {
    deals: { type: "string", default: "300000" },
    held: { type: "string", default: "20000" },
    hidden: { type: "string", default: "32" },
    epochs: { type: "string", default: "6" },
    lr: { type: "string", default: "0.002" },
    batch: { type: "string", default: "256" },
    rollout: { type: "string", default: "0" },
    out: { type: "string" },
  },
});
const deals = Number(values.deals);
const held = Number(values.held);
const hidden = Number(values.hidden);
const epochs = Number(values.epochs);
const policy = POLICIES[Number(values.rollout)]!;
const DEALER = 3;
const FIRST_SEED = 1_000_001;

interface Rows {
  hand: number[];
  contract: number[];
  p: number[];
  y: number[];
}
const newRows = (): Rows => ({ hand: [], contract: [], p: [], y: [] });
const train: Record<HandKind, Rows> = { suit: newRows(), nt: newRows(), at: newRows() };
const test: Record<HandKind, Rows> = { suit: newRows(), nt: newRows(), at: newRows() };

const started = performance.now();
for (let n = 0; n < deals + held; n++) {
  const deck = shuffledDeck((FIRST_SEED + n) * 7919).map(cardIndex);
  const first = [0, 1, 2, 3].map((s) => deck.slice(s * 5, s * 5 + 5).reduce((m, i) => m | (1 << i), 0));
  const hands = first.map((m, s) => deck.slice(20 + s * 3, 23 + s * 3).reduce((h, i) => h | (1 << i), m));
  const into = n < deals ? train : test;
  for (let c = 0; c < 6; c++) {
    const r = playOut(startRound(hands, c, 0, DEALER, 1, announcementPoints(hands, c)), policy);
    for (let seat = 0; seat < 4; seat++) {
      r.bidder = seat;
      const rec = roundResult(r).recorded;
      const team = seat & 1;
      const rows = into[handKind(c)];
      rows.hand.push(first[seat]!);
      rows.contract.push(c);
      // Seat's place in the bidding order (`positionOf` with the dealer in seat 3).
      rows.p.push((seat - DEALER + 3) % 4);
      rows.y.push(rec[team]! - rec[1 - team]!);
    }
  }
}
console.log(`played ${deals + held} deals in ${((performance.now() - started) / 1000).toFixed(1)}s`);

/** One network trained with Adam on squared error. */
function fit(rows: Rows, rand: () => number): NetWeights {
  const n = rows.y.length;
  const inputs = rows.y.map((_, i) => netInputs(rows.hand[i]!, rows.contract[i]!, rows.p[i]!));
  const mean = rows.y.reduce((a, b) => a + b, 0) / n;

  const size = NET_INPUTS * hidden + hidden + hidden + 1;
  const params = new Float64Array(size);
  const W1 = 0;
  const B1 = NET_INPUTS * hidden;
  const W2 = B1 + hidden;
  const B2 = W2 + hidden;
  for (let i = 0; i < NET_INPUTS * hidden; i++) params[W1 + i] = (rand() * 2 - 1) * 0.5;
  for (let j = 0; j < hidden; j++) {
    params[B1 + j] = 0.1;
    params[W2 + j] = (rand() * 2 - 1) * Math.sqrt(6 / hidden);
  }
  params[B2] = mean;

  const grad = new Float64Array(size);
  const m = new Float64Array(size);
  const v = new Float64Array(size);
  const act = new Float64Array(hidden);
  const batch = Number(values.batch);
  const order = Array.from({ length: n }, (_, i) => i);
  let step = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const lr = Number(values.lr) * (epoch < epochs - 1 ? 1 : 0.3);
    let loss = 0;
    for (let start = 0; start < n; start += batch) {
      grad.fill(0);
      const end = Math.min(n, start + batch);
      for (let k = start; k < end; k++) {
        const row = order[k]!;
        const on = inputs[row]!;
        let out = params[B2]!;
        for (let j = 0; j < hidden; j++) {
          let a = params[B1 + j]!;
          for (const i of on) a += params[W1 + i * hidden + j]!;
          act[j] = a > 0 ? a : 0;
          out += act[j]! * params[W2 + j]!;
        }
        const err = out - rows.y[row]!;
        loss += err * err;
        const d = (2 * err) / (end - start);
        grad[B2]! += d;
        for (let j = 0; j < hidden; j++) {
          if (act[j] === 0) continue;
          grad[W2 + j]! += d * act[j]!;
          const dh = d * params[W2 + j]!;
          grad[B1 + j]! += dh;
          for (const i of on) grad[W1 + i * hidden + j]! += dh;
        }
      }
      step++;
      const c1 = 1 - 0.9 ** step;
      const c2 = 1 - 0.999 ** step;
      for (let i = 0; i < size; i++) {
        const g = grad[i]!;
        m[i] = 0.9 * m[i]! + 0.1 * g;
        v[i] = 0.999 * v[i]! + 0.001 * g * g;
        params[i]! -= (lr * (m[i]! / c1)) / (Math.sqrt(v[i]! / c2) + 1e-8);
      }
    }
    console.log(`  epoch ${epoch + 1}: train mse ${(loss / n).toFixed(2)}`);
  }

  const round = (x: number) => Math.round(x * 10000) / 10000;
  return {
    hidden,
    w1: Array.from(params.subarray(W1, B1), round),
    b1: Array.from(params.subarray(B1, W2), round),
    w2: Array.from(params.subarray(W2, B2), round),
    b2: round(params[B2]!),
  };
}

/** R² of a model's predictions on held-out rows. */
function r2(rows: Rows, predict: (i: number) => number): number {
  const mean = rows.y.reduce((a, b) => a + b, 0) / rows.y.length;
  let ssr = 0;
  let sst = 0;
  rows.y.forEach((y, i) => {
    ssr += (y - predict(i)) ** 2;
    sst += (y - mean) ** 2;
  });
  return 1 - ssr / sst;
}

const nets = {} as Record<HandKind, NetWeights>;
const rand = mulberry32(17);
for (const kind of ["suit", "nt", "at"] as const) {
  console.log(`${kind}: ${train[kind].y.length} rows`);
  const net = fit(train[kind], rand);
  nets[kind] = net;
  const t = test[kind];
  const netR2 = r2(t, (i) => netValue(net, netInputs(t.hand[i]!, t.contract[i]!, t.p[i]!)));
  const linR2 = r2(t, (i) => handValue(t.hand[i]!, t.contract[i]!, t.p[i]!));
  console.log(`  held out: network R² ${netR2.toFixed(4)}, linear R² ${linR2.toFixed(4)}`);
}

const out = values.out ?? new URL("../../engine/src/handNetWeights.ts", import.meta.url).pathname;
const list = (xs: readonly number[]) => `[${xs.join(", ")}]`;
writeFileSync(
  out,
  `import type { HandKind } from "./handModel";
import type { NetWeights } from "./handNet";

/** Trained by \`pnpm --filter @belot/lab fit-net\` on ${deals} deals (hidden ${hidden}, ${epochs} epochs, rollout ${values.rollout}); do not edit by hand. */
export const HAND_NET: Record<HandKind, NetWeights> = {
${(["suit", "nt", "at"] as const)
  .map((k) => {
    const w = nets[k];
    return `  ${k}: {\n    hidden: ${w.hidden},\n    w1: ${list(w.w1)},\n    b1: ${list(w.b1)},\n    w2: ${list(w.w2)},\n    b2: ${w.b2},\n  },`;
  })
  .join("\n")}
};
`,
);
console.log(`wrote ${out}`);
