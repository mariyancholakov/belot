import {
  above,
  ALL_TRUMPS,
  greedyPolicy,
  lowest,
  NO_TRUMPS,
  POINTS,
  STRENGTH,
  SUIT_MASK,
  TRUMP,
  TRUMPS,
  trickWinnerSim,
  winningCards,
  type SimPolicy,
} from "./sim";

/**
 * Playing policies for simulated rounds. Each player uses only its own hand and the cards played
 * so far, never the other hands, so a sampled deal is played the way it would be at the table.
 */

/** Cards of `mask` that no card still out can beat in their own suit. */
function masters(mask: number, unseen: number, c: number): number {
  const s = STRENGTH[c]!;
  let out = 0;
  for (let m = mask; m !== 0; m &= m - 1) {
    const i = lowest(m);
    if ((unseen & above(c, i >> 3, s[i]!)) === 0) out |= 1 << i;
  }
  return out;
}

/** Lowest card by points, then strength; `dear` reverses it. */
function byValue(mask: number, c: number, dear: boolean): number {
  const p = POINTS[c]!;
  const s = STRENGTH[c]!;
  const t = TRUMP[c]!;
  let best = -1;
  let key = dear ? -1 : 1e9;
  for (let m = mask; m !== 0; m &= m - 1) {
    const i = lowest(m);
    // Trumps count as dearer than any plain card: they are worth keeping.
    const k = t[i]! * 4096 + p[i]! * 16 + s[i]!;
    if (dear ? k > key : k < key) {
      key = k;
      best = i;
    }
  }
  return best;
}

function weakestByStrength(mask: number, c: number): number {
  const s = STRENGTH[c]!;
  const t = TRUMP[c]!;
  let best = -1;
  let key = 1e9;
  for (let m = mask; m !== 0; m &= m - 1) {
    const i = lowest(m);
    const k = t[i]! * 16 + s[i]!;
    if (k < key) {
      key = k;
      best = i;
    }
  }
  return best;
}

/**
 * Leads sure winners (pulling trumps first when its team bid), otherwise something cheap; feeds
 * points only to a partner who is sure to take the trick; wins with the cheapest card that does.
 */
export const smartPolicy: SimPolicy = (r, legal) => {
  const c = r.contract;
  const me = r.turn;
  const hand = r.hands[me]!;
  const unseen = ~(hand | r.played);
  const trumpsOut = c === NO_TRUMPS ? 0 : unseen & TRUMPS[c]!;

  if (r.trick.length === 0) {
    const sure = masters(legal, unseen, c);
    if (c < NO_TRUMPS) {
      const myTrumps = legal & SUIT_MASK[c]!;
      const weBid = (r.bidder & 1) === (me & 1);
      if (weBid && trumpsOut !== 0 && (sure & myTrumps) !== 0) return byValue(sure & myTrumps, c, true);
      const plainSure = sure & ~TRUMPS[c]!;
      if (plainSure !== 0) return byValue(plainSure, c, true);
      const plain = legal & ~TRUMPS[c]!;
      return byValue(plain !== 0 ? plain : legal, c, false);
    }
    if (sure !== 0) return byValue(sure, c, true);
    return byValue(legal, c, false);
  }

  const partner = (me + 2) % 4;
  const last = r.trick.length === 3;
  const winner = trickWinnerSim(r.trick, r.leader, c);
  if (winner === partner) {
    const best = r.trick[(winner - r.leader + 4) % 4]!;
    const beaten = (unseen & above(c, best >> 3, STRENGTH[c]![best]!)) !== 0 || (TRUMP[c]![best] === 0 && trumpsOut !== 0);
    if (last || !beaten) {
      const spare = legal & ~masters(legal, unseen, c);
      return byValue(spare !== 0 ? spare : legal, c, spare !== 0);
    }
    return byValue(legal, c, false);
  }

  const winners = winningCards(r, legal);
  if (winners !== 0) {
    if (last) return weakestByStrength(winners, c);
    const safe = masters(winners, unseen, c) & (c === NO_TRUMPS || c === ALL_TRUMPS ? -1 : TRUMPS[c]! | (trumpsOut === 0 ? -1 : 0));
    return weakestByStrength(safe !== 0 ? safe : winners, c);
  }
  return byValue(legal, c, false);
};

/** Rollout policies by number, for tuning from the arena. */
export const POLICIES: readonly SimPolicy[] = [greedyPolicy, smartPolicy];
