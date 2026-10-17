import type { HandKind, HandModel } from "./handModel";
import { ALL_TRUMPS, NO_TRUMPS } from "./sim";

/**
 * A small neural network that values a five-card hand for a contract, the learned alternative to
 * the linear hand model. One network per kind of contract, each with one hidden layer of ReLU
 * units, trained on simulated rounds by `pnpm --filter @belot/lab fit-net`.
 *
 * Inputs: 32 card slots and 4 bidding positions. The suits are put in a fixed order so that hands
 * that play the same share one input: in a suit contract the trump suit comes first, then the other
 * suits; in no-trumps and all-trumps all four suits are alike. Suits that are alike are ordered by
 * their cards, highest first.
 */
export const NET_INPUTS = 36;

export interface NetWeights {
  hidden: number;
  /** Input-to-hidden weights, `hidden` per input. */
  w1: readonly number[];
  b1: readonly number[];
  w2: readonly number[];
  b2: number;
}

/** The input slots that are on for this hand: its five cards, suits in the fixed order, and its position. */
export function netInputs(hand: number, contract: number, p: number): number[] {
  const bytes = [0, 1, 2, 3].map((s) => (hand >>> (s * 8)) & 0xff);
  const order = contract < NO_TRUMPS ? [bytes[contract]!, ...bytes.filter((_, s) => s !== contract).sort((a, b) => b - a)] : bytes.sort((a, b) => b - a);
  const on: number[] = [];
  order.forEach((bits, k) => {
    for (let r = 0; r < 8; r++) if (bits & (1 << r)) on.push(k * 8 + r);
  });
  on.push(32 + p);
  return on;
}

/** The network's output for the given input slots. */
export function netValue(w: NetWeights, on: readonly number[]): number {
  const h = w.hidden;
  let out = w.b2;
  for (let j = 0; j < h; j++) {
    let a = w.b1[j]!;
    for (const i of on) a += w.w1[i * h + j]!;
    if (a > 0) out += a * w.w2[j]!;
  }
  return out;
}

export function netModel(nets: Record<HandKind, NetWeights>): HandModel {
  return (hand, contract, p) => {
    const net = contract === NO_TRUMPS ? nets.nt : contract === ALL_TRUMPS ? nets.at : nets.suit;
    return netValue(net, netInputs(hand, contract, p));
  };
}
