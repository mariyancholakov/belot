import { ALL_TRUMPS, NO_TRUMPS, popcount, SUIT_MASK } from "./sim";
import { HAND_WEIGHTS } from "./handWeights";

/**
 * A quick estimate of what a contract is worth from the five cards held while bidding: a linear
 * model over a few features of the hand, fitted on simulated rounds (`pnpm --filter @belot/lab
 * fit-hands`). Bots use it to guess what the other players' bids say about their cards.
 */

export type HandKind = "suit" | "nt" | "at";

export const handKind = (contract: number): HandKind => (contract === NO_TRUMPS ? "nt" : contract === ALL_TRUMPS ? "at" : "suit");

// Rank indices: 7 8 9 10 J Q K A.
const has = (hand: number, suit: number, rank: number) => (hand >>> (suit * 8 + rank)) & 1;

/** Seat's place in the bidding order: 0 bids and leads first, 3 is the dealer. */
export const positionOf = (seat: number, dealer: number): number => (seat - dealer + 3) % 4;

function position(p: number): number[] {
  return [p === 1 ? 1 : 0, p === 2 ? 1 : 0, p === 3 ? 1 : 0];
}

/** Sequences and carrés already in the hand, in tens of points. */
function announcementTens(hand: number): number {
  let total = 0;
  for (let r = 2; r < 8; r++) if ((hand & (0x01010101 << r)) === 0x01010101 << r) total += r === 4 ? 20 : r === 2 ? 15 : 10;
  for (let s = 0; s < 4; s++) {
    const bits = (hand >>> (s * 8)) & 0xff;
    let run = 0;
    for (let r = 0; r <= 8; r++) {
      if (r < 8 && bits & (1 << r)) run++;
      else {
        if (run >= 3) total += run >= 5 ? 10 : run === 4 ? 5 : 2;
        run = 0;
      }
    }
  }
  return total;
}

export function handFeatures(hand: number, contract: number, p: number): number[] {
  const kind = handKind(contract);
  const ann = announcementTens(hand);
  if (kind === "suit") {
    const t = contract;
    const trumps = popcount(hand & SUIT_MASK[t]!);
    let sideAces = 0;
    let sideTensWithAce = 0;
    let sideTens = 0;
    let sideKings = 0;
    let voids = 0;
    for (let s = 0; s < 4; s++) {
      if (s === t) continue;
      const a = has(hand, s, 7);
      sideAces += a;
      if (has(hand, s, 3)) {
        if (a) sideTensWithAce++;
        else sideTens++;
      }
      sideKings += has(hand, s, 6);
      if ((hand & SUIT_MASK[s]!) === 0) voids++;
    }
    const j = has(hand, t, 4);
    const nine = has(hand, t, 2);
    return [
      1,
      has(hand, t, 0) + has(hand, t, 1),
      nine,
      has(hand, t, 3),
      j,
      has(hand, t, 5),
      has(hand, t, 6),
      has(hand, t, 7),
      j * nine,
      trumps >= 3 ? trumps - 2 : 0,
      j * (trumps >= 3 ? 1 : 0),
      has(hand, t, 5) * has(hand, t, 6),
      sideAces,
      sideTensWithAce,
      sideTens,
      sideKings,
      voids * (trumps >= 2 ? 1 : 0),
      ann,
      ...position(p),
    ];
  }
  if (kind === "nt") {
    let aces = 0;
    let tensWithAce = 0;
    let tens = 0;
    let guardedKings = 0;
    let longest = 0;
    for (let s = 0; s < 4; s++) {
      const a = has(hand, s, 7);
      const ten = has(hand, s, 3);
      aces += a;
      if (ten) {
        if (a) tensWithAce++;
        else tens++;
      }
      if (has(hand, s, 6) && (a || ten)) guardedKings++;
      longest = Math.max(longest, popcount(hand & SUIT_MASK[s]!));
    }
    return [1, aces, aces >= 2 ? aces - 1 : 0, tensWithAce, tens, guardedKings, longest >= 3 ? longest - 2 : 0, ann, ...position(p), p === 0 ? aces : 0];
  }
  let jacks = 0;
  let nines = 0;
  let jackNine = 0;
  let aces = 0;
  let tens = 0;
  let belots = 0;
  for (let s = 0; s < 4; s++) {
    const j = has(hand, s, 4);
    const n = has(hand, s, 2);
    jacks += j;
    nines += n;
    jackNine += j * n;
    aces += has(hand, s, 7);
    tens += has(hand, s, 3);
    belots += has(hand, s, 5) * has(hand, s, 6);
  }
  return [1, jacks, jacks >= 2 ? jacks - 1 : 0, nines, jackNine, aces, tens, belots, ann, ...position(p)];
}

/** Expected recorded points for the bidding team (theirs minus the other team's) if this hand's team plays `contract`. */
export function handValue(hand: number, contract: number, p: number): number {
  const w = HAND_WEIGHTS[handKind(contract)];
  const f = handFeatures(hand, contract, p);
  let v = 0;
  for (let i = 0; i < f.length; i++) v += f[i]! * (w[i] ?? 0);
  return v;
}
