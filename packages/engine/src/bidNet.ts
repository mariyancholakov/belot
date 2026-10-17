/**
 * A small neural network that predicts how a player bids: from the five cards it holds and the
 * auction so far, the probability of each action. Trained by `pnpm --filter @belot/lab fit-bids`
 * on the bids of the sampling bot playing itself. The bidder uses it to read what the other
 * players' bids say about their cards, and to guess how the rest of the auction goes.
 *
 * Inputs (all on/off): 32 card slots; bidding position (4); highest contract so far (none or one
 * of 6); who holds it (the player, its partner, an opponent); contra on; the partner's highest bid
 * (none or 6); the opponents' highest bid (none or 6).
 * Outputs: pass, a bid in each of the 6 contracts, contra, re-contra.
 */
export const BID_INPUTS = 61;
export const BID_ACTIONS = 9;
export const PASS = 0;
export const CONTRA = 7;
export const RECONTRA = 8;
/** Output index of a bid in contract `c` (0-5). */
export const bidIndex = (c: number): number => 1 + c;

export interface BidNetWeights {
  hidden: number;
  /** Input-to-hidden weights, `hidden` per input. */
  w1: readonly number[];
  b1: readonly number[];
  /** Hidden-to-output weights, `BID_ACTIONS` per hidden unit. */
  w2: readonly number[];
  b2: readonly number[];
}

/**
 * Input slots for everything but the cards. `holder`: -1 nobody has bid, 0 the player, 1 its
 * partner, 2 an opponent. Contracts are -1 for none.
 */
export function bidStateInputs(p: number, highest: number, holder: number, multiplier: number, partnerBid: number, opponentBid: number): number[] {
  const on = [32 + p, 36 + highest + 1];
  if (holder >= 0) on.push(43 + holder);
  if (multiplier > 1) on.push(46);
  on.push(47 + partnerBid + 1, 54 + opponentBid + 1);
  return on;
}

/** Hidden pre-activations from the state inputs alone; the cards are added by `bidLogits`. */
export function stateHidden(net: BidNetWeights, state: readonly number[]): Float64Array {
  const h = net.hidden;
  const out = Float64Array.from(net.b1);
  for (const i of state) for (let j = 0; j < h; j++) out[j]! += net.w1[i * h + j]!;
  return out;
}

/** Output scores for a hand (32-bit card mask) on top of `stateHidden`; illegal actions get -Infinity. */
export function bidLogits(net: BidNetWeights, base: Float64Array, hand: number, legal: number, out: Float64Array = new Float64Array(BID_ACTIONS)): Float64Array {
  const h = net.hidden;
  const act = new Float64Array(base);
  for (let m = hand; m !== 0; m &= m - 1) {
    const i = 31 - Math.clz32(m & -m);
    for (let j = 0; j < h; j++) act[j]! += net.w1[i * h + j]!;
  }
  for (let k = 0; k < BID_ACTIONS; k++) out[k] = legal & (1 << k) ? net.b2[k]! : -Infinity;
  for (let j = 0; j < h; j++) {
    const a = act[j]!;
    if (a <= 0) continue;
    for (let k = 0; k < BID_ACTIONS; k++) if (legal & (1 << k)) out[k]! += a * net.w2[j * BID_ACTIONS + k]!;
  }
  return out;
}

/** Probability of `action` among the legal ones. */
export function bidProbability(logits: Float64Array, action: number): number {
  let max = -Infinity;
  for (const x of logits) max = Math.max(max, x);
  let sum = 0;
  for (const x of logits) sum += Math.exp(x - max);
  return Math.exp(logits[action]! - max) / sum;
}

/** The most likely legal action. */
export function likeliestBid(logits: Float64Array): number {
  let best = 0;
  for (let k = 1; k < BID_ACTIONS; k++) if (logits[k]! > logits[best]!) best = k;
  return best;
}
