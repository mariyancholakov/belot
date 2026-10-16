/**
 * Fits the quick hand model (`handModel.ts`): deals many random rounds, plays every contract out
 * with the greedy playout, and regresses the bidding team's margin on the features of each
 * seat's first five cards. Writes the weights to `packages/engine/src/handWeights.ts`.
 *
 *   pnpm --filter @belot/lab fit-hands [--deals 100000]
 */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  announcementPoints,
  cardIndex,
  greedyPolicy,
  handFeatures,
  handKind,
  playOut,
  roundResult,
  shuffledDeck,
  startRound,
  type HandKind,
} from "@belot/engine";
import { solveRidge } from "./regression";

const { values } = parseArgs({ options: { deals: { type: "string", default: "100000" }, out: { type: "string" } } });
const deals = Number(values.deals);
const DEALER = 3;

const rows: Record<HandKind, { x: number[][]; y: number[] }> = { suit: { x: [], y: [] }, nt: { x: [], y: [] }, at: { x: [], y: [] } };

for (let seed = 1; seed <= deals; seed++) {
  const deck = shuffledDeck(seed * 7919).map(cardIndex);
  const first = [0, 1, 2, 3].map((s) => deck.slice(s * 5, s * 5 + 5).reduce((m, i) => m | (1 << i), 0));
  const hands = first.map((m, s) => deck.slice(20 + s * 3, 23 + s * 3).reduce((h, i) => h | (1 << i), m));
  const bonus = announcementPoints(hands);
  for (let c = 0; c < 6; c++) {
    const r = playOut(startRound(hands, c, 0, DEALER, 1, [bonus[0], bonus[1]]), greedyPolicy);
    for (let seat = 0; seat < 4; seat++) {
      r.bidder = seat;
      const rec = roundResult(r).recorded;
      const team = seat & 1;
      const kind = handKind(c);
      rows[kind].x.push(handFeatures(first[seat]!, c, seat));
      rows[kind].y.push(rec[team]! - rec[1 - team]!);
    }
  }
}

const weights: Record<string, number[]> = {};
for (const kind of ["suit", "nt", "at"] as const) {
  const { x, y } = rows[kind];
  const w = solveRidge(x, y, 1);
  const mean = y.reduce((a, b) => a + b, 0) / y.length;
  let ssr = 0;
  let sst = 0;
  x.forEach((f, i) => {
    const p = f.reduce((s, v, k) => s + v * w[k]!, 0);
    ssr += (y[i]! - p) ** 2;
    sst += (y[i]! - mean) ** 2;
  });
  console.log(`${kind}: ${y.length} rows, mean ${mean.toFixed(2)}, R² ${(1 - ssr / sst).toFixed(3)}`);
  weights[kind] = w.map((v) => Math.round(v * 1000) / 1000);
}

const out = values.out ?? new URL("../../engine/src/handWeights.ts", import.meta.url).pathname;
writeFileSync(
  out,
  `import type { HandKind } from "./handModel";

/** Fitted by \`pnpm --filter @belot/lab fit-hands\` on ${deals} deals; do not edit by hand. */
export const HAND_WEIGHTS: Record<HandKind, readonly number[]> = {
${(["suit", "nt", "at"] as const).map((k) => `  ${k}: [${weights[k]!.join(", ")}],`).join("\n")}
};
`,
);
console.log(`wrote ${out}`);
