import { BELOT_POINTS } from "./announcements";
import { RANKS, SUITS, type Card, type Contract } from "./cards";
import { LAST_TRICK_BONUS, TRICKS_PER_ROUND } from "./game";
import { scoreRound, type Multiplier, type RoundResult, type Team } from "./scoring";

/**
 * A fast model of one round for bots that play many rounds in their head. A card is a number
 * 0-31 (suit × 8 + rank, in `SUITS` and `RANKS` order) and a hand is a 32-bit mask of them. The
 * rules are the same as in `tricks.ts` and `game.ts`; tests check the two agree.
 */

export const NO_TRUMPS = 4;
export const ALL_TRUMPS = 5;
/** Contracts as numbers: 0-3 a suit, 4 no trumps, 5 all trumps. */
export const CONTRACTS: readonly Contract[] = [...SUITS, "no-trumps", "all-trumps"];

export const contractId = (contract: Contract): number => CONTRACTS.indexOf(contract);
export const cardIndex = (card: Card): number => SUITS.indexOf(card.suit) * 8 + RANKS.indexOf(card.rank);
export const cardOf = (index: number): Card => ({ suit: SUITS[index >> 3]!, rank: RANKS[index & 7]! });
export const maskOf = (cards: readonly Card[]): number => cards.reduce((m, c) => m | (1 << cardIndex(c)), 0);
export const cardsOf = (mask: number): Card[] => indices(mask).map(cardOf);

export const SUIT_MASK: readonly number[] = [0xff, 0xff00, 0xff0000, 0xff000000 | 0];
export const FULL_MASK = -1;

export function popcount(m: number): number {
  m = m - ((m >>> 1) & 0x55555555);
  m = (m & 0x33333333) + ((m >>> 2) & 0x33333333);
  return (Math.imul((m + (m >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24);
}

/** Index of the lowest card in a non-empty mask. */
export const lowest = (m: number): number => 31 - Math.clz32(m & -m);

export function indices(mask: number): number[] {
  const out: number[] = [];
  for (let m = mask; m !== 0; m &= m - 1) out.push(lowest(m));
  return out;
}

// Rank order 7 8 9 10 J Q K A.
const TRUMP_STRENGTH = [0, 1, 6, 4, 7, 2, 3, 5];
const PLAIN_STRENGTH = [0, 1, 2, 6, 3, 4, 5, 7];
const TRUMP_POINTS = [0, 0, 14, 10, 20, 3, 4, 11];
const PLAIN_POINTS = [0, 0, 0, 10, 2, 3, 4, 11];

/** Per contract, per card: trump or not, strength within its suit, card points. */
export const TRUMP: readonly Uint8Array[] = [];
export const STRENGTH: readonly Uint8Array[] = [];
export const POINTS: readonly Uint8Array[] = [];
/** Per contract and suit: the trump mask, and cards of the suit above each strength (index strength + 1). */
export const TRUMPS: readonly number[] = [];
export const ABOVE: readonly (readonly (readonly number[])[])[] = [];

for (let c = 0; c < 6; c++) {
  const trump = new Uint8Array(32);
  const strength = new Uint8Array(32);
  const pts = new Uint8Array(32);
  let trumps = 0;
  for (let i = 0; i < 32; i++) {
    const t = c === ALL_TRUMPS || (c < 4 && i >> 3 === c);
    trump[i] = t ? 1 : 0;
    strength[i] = (t ? TRUMP_STRENGTH : PLAIN_STRENGTH)[i & 7]!;
    pts[i] = (t ? TRUMP_POINTS : PLAIN_POINTS)[i & 7]!;
    if (t) trumps |= 1 << i;
  }
  const above = SUITS.map((_, s) =>
    Array.from({ length: 9 }, (_, k) => {
      let m = 0;
      for (let r = 0; r < 8; r++) if (strength[s * 8 + r]! > k - 1) m |= 1 << (s * 8 + r);
      return m;
    }),
  );
  (TRUMP as Uint8Array[]).push(trump);
  (STRENGTH as Uint8Array[]).push(strength);
  (POINTS as Uint8Array[]).push(pts);
  (TRUMPS as number[]).push(trumps);
  (ABOVE as number[][][]).push(above);
}

/** Cards of `suit` stronger than strength `level` (-1 = all of the suit). */
export const above = (c: number, suit: number, level: number): number => ABOVE[c]![suit]![level + 1]!;

/** The highest card of a non-empty mask by trick strength (ties go to the lower index). */
export function strongest(mask: number, c: number): number {
  const s = STRENGTH[c]!;
  const t = TRUMP[c]!;
  let best = -1;
  let key = -1;
  for (let m = mask; m !== 0; m &= m - 1) {
    const i = lowest(m);
    const k = t[i]! * 8 + s[i]!;
    if (k > key) {
      key = k;
      best = i;
    }
  }
  return best;
}

export function weakest(mask: number, c: number): number {
  const s = STRENGTH[c]!;
  const t = TRUMP[c]!;
  let best = -1;
  let key = 99;
  for (let m = mask; m !== 0; m &= m - 1) {
    const i = lowest(m);
    const k = t[i]! * 8 + s[i]!;
    if (k < key) {
      key = k;
      best = i;
    }
  }
  return best;
}

/** One round in play: hands, the trick on the table and what each team has taken. */
export interface SimRound {
  contract: number;
  /** Seat that won the bidding. */
  bidder: number;
  multiplier: Multiplier;
  hands: number[];
  /** Cards of the current trick in play order; the trick was led by `leader`. */
  trick: number[];
  leader: number;
  turn: number;
  tricksPlayed: number;
  tricks: [number, number];
  /** Card points taken so far, last-trick bonus included. */
  points: [number, number];
  /** Announcement and belot points per team. */
  bonus: [number, number];
  /** Every card played this round. */
  played: number;
  hanging: number;
}

export function cloneRound(r: SimRound): SimRound {
  return {
    ...r,
    hands: [...r.hands],
    trick: [...r.trick],
    tricks: [r.tricks[0], r.tricks[1]],
    points: [r.points[0], r.points[1]],
    bonus: [r.bonus[0], r.bonus[1]],
  };
}

/** Seat currently winning the trick. */
export function trickWinnerSim(trick: readonly number[], leader: number, c: number): number {
  const t = TRUMP[c]!;
  const s = STRENGTH[c]!;
  let best = trick[0]!;
  let seat = leader;
  for (let i = 1; i < trick.length; i++) {
    const card = trick[i]!;
    const beats = t[card]! !== t[best]! ? t[card]! === 1 : card >> 3 === best >> 3 && s[card]! > s[best]!;
    if (beats) {
      best = card;
      seat = (leader + i) % 4;
    }
  }
  return seat;
}

/** Mask of the cards `seat` may play from `hand`, as in `legalPlays`. */
export function legalMask(hand: number, trick: readonly number[], leader: number, seat: number, c: number): number {
  if (trick.length === 0) return hand;
  const lead = trick[0]!;
  const suit = lead >> 3;
  const followers = hand & SUIT_MASK[suit]!;
  const t = TRUMP[c]!;
  const s = STRENGTH[c]!;
  if (followers !== 0) {
    if (t[lead] === 1) {
      let best = -1;
      for (const card of trick) if (card >> 3 === suit && s[card]! > best) best = s[card]!;
      const higher = followers & above(c, suit, best);
      return higher !== 0 ? higher : followers;
    }
    return followers;
  }
  if (c >= NO_TRUMPS) return hand;
  const winner = trickWinnerSim(trick, leader, c);
  if ((seat + 2) % 4 === winner) return hand;
  const trumps = hand & SUIT_MASK[c]!;
  if (trumps === 0) return hand;
  let best = -1;
  for (const card of trick) if (t[card] === 1 && s[card]! > best) best = s[card]!;
  if (best < 0) return trumps;
  const higher = trumps & above(c, c, best);
  return higher !== 0 ? higher : trumps;
}

export const legalNow = (r: SimRound): number => legalMask(r.hands[r.turn]!, r.trick, r.leader, r.turn, r.contract);

/** Whether a K or Q played from `hand` calls a belot (the bot always calls it). */
export function callsBelot(hand: number, card: number, c: number): boolean {
  if (c === NO_TRUMPS || TRUMP[c]![card] !== 1) return false;
  const rank = card & 7;
  if (rank !== 5 && rank !== 6) return false;
  const partner = (card & ~7) | (rank === 5 ? 6 : 5);
  return (hand & (1 << partner)) !== 0;
}

/** Play `card` for the seat on turn. The card must be legal; this is not checked. */
export function playCard(r: SimRound, card: number): void {
  const seat = r.turn;
  const hand = r.hands[seat]!;
  if (callsBelot(hand, card, r.contract)) r.bonus[(seat & 1) as Team] += BELOT_POINTS;
  r.hands[seat] = hand & ~(1 << card);
  r.played |= 1 << card;
  r.trick.push(card);
  if (r.trick.length < 4) {
    r.turn = (seat + 1) % 4;
    return;
  }
  const winner = trickWinnerSim(r.trick, r.leader, r.contract);
  const team = (winner & 1) as Team;
  const pts = POINTS[r.contract]!;
  r.points[team] += pts[r.trick[0]!]! + pts[r.trick[1]!]! + pts[r.trick[2]!]! + pts[r.trick[3]!]!;
  r.tricks[team] += 1;
  r.tricksPlayed += 1;
  if (r.tricksPlayed === TRICKS_PER_ROUND) r.points[team] += LAST_TRICK_BONUS;
  r.trick = [];
  r.leader = winner;
  r.turn = winner;
}

export const roundOver = (r: SimRound): boolean => r.tricksPlayed === TRICKS_PER_ROUND;

/** The scored result of a finished round. */
export function roundResult(r: SimRound): RoundResult {
  const capo: Team | null = r.tricks[0] === TRICKS_PER_ROUND ? 0 : r.tricks[1] === TRICKS_PER_ROUND ? 1 : null;
  return scoreRound({
    contract: CONTRACTS[r.contract]!,
    bidder: (r.bidder & 1) as Team,
    multiplier: r.multiplier,
    cardPoints: r.points,
    announcements: r.bonus,
    capo,
    hanging: r.hanging,
  });
}

/** Recorded points of `team` minus the other team's, for a finished round. */
export function margin(r: SimRound, team: number): number {
  const rec = roundResult(r).recorded;
  return rec[team]! - rec[1 - team]!;
}

/** A playing policy inside the simulation: picks one card from the legal mask. */
export type SimPolicy = (r: SimRound, legal: number) => number;

export function playOut(r: SimRound, policy: SimPolicy): SimRound {
  while (r.tricksPlayed < TRICKS_PER_ROUND) {
    const legal = legalNow(r);
    playCard(r, legal & (legal - 1) ? policy(r, legal) : lowest(legal));
  }
  return r;
}

/** A fresh round right after bidding, with eight cards in each hand; seat after the dealer leads. */
export function startRound(hands: readonly number[], contract: number, bidder: number, dealer: number, multiplier: Multiplier = 1, bonus: [number, number] = [0, 0]): SimRound {
  const leader = (dealer + 1) % 4;
  return {
    contract,
    bidder,
    multiplier,
    hands: [...hands],
    trick: [],
    leader,
    turn: leader,
    tricksPlayed: 0,
    tricks: [0, 0],
    points: [0, 0],
    bonus,
    played: 0,
    hanging: 0,
  };
}

/** Card points, then strength: the cheapest card to give away. */
function cheapest(mask: number, c: number): number {
  const p = POINTS[c]!;
  const s = STRENGTH[c]!;
  let best = -1;
  let key = 1e9;
  for (let m = mask; m !== 0; m &= m - 1) {
    const i = lowest(m);
    const k = p[i]! * 16 + s[i]!;
    if (k < key) {
      key = k;
      best = i;
    }
  }
  return best;
}

function dearest(mask: number, c: number): number {
  const p = POINTS[c]!;
  const s = STRENGTH[c]!;
  let best = -1;
  let key = -1;
  for (let m = mask; m !== 0; m &= m - 1) {
    const i = lowest(m);
    const k = p[i]! * 16 + s[i]!;
    if (k > key) {
      key = k;
      best = i;
    }
  }
  return best;
}

/** Legal cards that would put `seat` ahead in the current trick. */
export function winningCards(r: SimRound, legal: number): number {
  let out = 0;
  for (let m = legal; m !== 0; m &= m - 1) {
    const card = lowest(m);
    r.trick.push(card);
    if (trickWinnerSim(r.trick, r.leader, r.contract) === r.turn) out |= 1 << card;
    r.trick.pop();
  }
  return out;
}

/** The basic bot's play: lead the strongest plain card, feed a winning partner, else win cheaply or throw the cheapest. */
export const greedyPolicy: SimPolicy = (r, legal) => {
  const c = r.contract;
  if (r.trick.length === 0) {
    const plain = legal & ~TRUMPS[c]!;
    return strongestPlain(plain !== 0 ? plain : legal, c);
  }
  if (trickWinnerSim(r.trick, r.leader, c) === (r.turn + 2) % 4) return dearest(legal, c);
  const winners = winningCards(r, legal);
  if (winners !== 0) return weakestPlain(winners, c);
  return cheapest(legal, c);
};

/** Highest strength number, trump or not. */
function strongestPlain(mask: number, c: number): number {
  const s = STRENGTH[c]!;
  let best = -1;
  let key = -1;
  for (let m = mask; m !== 0; m &= m - 1) {
    const i = lowest(m);
    if (s[i]! > key) {
      key = s[i]!;
      best = i;
    }
  }
  return best;
}

function weakestPlain(mask: number, c: number): number {
  const s = STRENGTH[c]!;
  let best = -1;
  let key = 99;
  for (let m = mask; m !== 0; m &= m - 1) {
    const i = lowest(m);
    if (s[i]! < key) {
      key = s[i]!;
      best = i;
    }
  }
  return best;
}

const CARRE_POINTS = [0, 0, 150, 100, 200, 100, 100, 100];

/**
 * Announcement points per team when every seat declares everything it holds, as
 * `resolveAnnouncements` counts them (belots are left out: the simulation adds them as played).
 */
export function announcementPoints(hands: readonly number[]): [number, number] {
  const best = [-1, -1];
  const total: [number, number] = [0, 0];
  for (let seat = 0; seat < 4; seat++) {
    const hand = hands[seat]!;
    const team = seat & 1;
    let carres = 0;
    for (let r = 2; r < 8; r++) {
      const rank = 0x01010101 << r;
      if ((hand & rank) === rank) {
        carres |= rank;
        total[team]! += CARRE_POINTS[r]!;
        best[team] = Math.max(best[team]!, CARRE_POINTS[r]! * 10 + r);
      }
    }
    for (let s = 0; s < 4; s++) {
      const bits = (hand >>> (s * 8)) & 0xff;
      let r = 0;
      while (r < 8) {
        if (!(bits & (1 << r))) {
          r++;
          continue;
        }
        let end = r;
        while (end + 1 < 8 && bits & (1 << (end + 1))) end++;
        const length = end - r + 1;
        const run = ((1 << length) - 1) << (r + s * 8);
        if (length >= 3 && (run & carres) === 0) {
          const pts = length >= 5 ? 100 : length === 4 ? 50 : 20;
          total[team]! += pts;
          best[team] = Math.max(best[team]!, pts * 10 + end);
        }
        r = end + 1;
      }
    }
  }
  if (best[0] === best[1]) return [0, 0];
  return best[0]! > best[1]! ? [total[0], 0] : [0, total[1]];
}
