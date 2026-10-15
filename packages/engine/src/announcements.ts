import { cardEquals, fullDeck, isTrump, RANKS, strength, SUITS, type Card, type Contract, type Rank, type Suit } from "./cards";
import type { Team } from "./scoring";

export type AnnouncementKind = "terca" | "fifty" | "hundred" | "carre";

export interface Announcement {
  kind: AnnouncementKind;
  points: number;
  /** Suit of a sequence; absent for a carré. */
  suit?: Suit;
  /** Highest card of the sequence, or the rank of the carré. */
  high: Rank;
  cards: Card[];
}

export const BELOT_POINTS = 20;

const CARRE_POINTS: Partial<Record<Rank, number>> = { "9": 150, J: 200, "10": 100, Q: 100, K: 100, A: 100 };
const natural = (rank: Rank) => RANKS.indexOf(rank);

function sequenceKind(length: number): { kind: AnnouncementKind; points: number } {
  if (length >= 5) return { kind: "hundred", points: 100 };
  if (length === 4) return { kind: "fifty", points: 50 };
  return { kind: "terca", points: 20 };
}

/** All announcements a hand holds, before the carré cancels overlapping sequences. */
export function findAnnouncements(hand: readonly Card[]): Announcement[] {
  const found: Announcement[] = [];

  // Carrés
  const carreRanks = new Set<Rank>();
  for (const rank of RANKS) {
    const points = CARRE_POINTS[rank];
    if (points === undefined) continue;
    const cards = hand.filter((c) => c.rank === rank);
    if (cards.length === 4) {
      carreRanks.add(rank);
      found.push({ kind: "carre", points, high: rank, cards });
    }
  }

  // Sequences
  for (const suit of SUITS) {
    const inSuit = hand
      .filter((c) => c.suit === suit)
      .sort((a, b) => natural(a.rank) - natural(b.rank));
    let run: Card[] = [];
    const flush = () => {
      if (run.length >= 3) {
        const { kind, points } = sequenceKind(run.length);
        // A carré cancels any sequence that uses one of its cards.
        if (!run.some((c) => carreRanks.has(c.rank))) {
          found.push({ kind, points, suit, high: run[run.length - 1]!.rank, cards: run });
        }
      }
      run = [];
    };
    for (const card of inSuit) {
      const last = run[run.length - 1];
      if (last && natural(card.rank) !== natural(last.rank) + 1) flush();
      run.push(card);
    }
    flush();
  }
  return found;
}

/** Suits in which the hand holds both K and Q, and belot is allowed to count. */
export function findBelots(hand: readonly Card[], contract: Contract): Suit[] {
  if (contract === "no-trumps") return [];
  const suits = contract === "all-trumps" ? SUITS : [contract];
  return suits.filter(
    (suit) =>
      hand.some((c) => c.suit === suit && c.rank === "K") &&
      hand.some((c) => c.suit === suit && c.rank === "Q"),
  );
}

/** Comparison key: more points first, then the higher top card. */
function strengthKey(a: Announcement): number {
  return a.points * 10 + natural(a.high);
}

function best(announcements: readonly Announcement[]): number {
  return announcements.reduce((m, a) => Math.max(m, strengthKey(a)), -1);
}

export interface AnnouncementResult {
  /** Announcements that count, per seat. */
  counted: Announcement[][];
  /** Belot suits per seat (always count). */
  belots: Suit[][];
  /** Total points per team (belot included). */
  points: [number, number];
}

/**
 * Work out which announcements count, from what each seat actually declared. The team whose
 * best declared announcement is stronger scores all of its declared announcements; if the best
 * ones tie, neither team scores announcements. Declared belots always count for the player who
 * called them.
 */
export function resolveDeclared(declared: readonly (readonly Announcement[])[], belots: readonly (readonly Suit[])[]): AnnouncementResult {
  const teamAnnouncements = (team: Team) => declared.filter((_, seat) => seat % 2 === team).flat();
  const bestA = best(teamAnnouncements(0));
  const bestB = best(teamAnnouncements(1));
  const winner: Team | null = bestA === bestB ? null : bestA > bestB ? 0 : 1;

  const counted = declared.map((list, seat) => (winner !== null && seat % 2 === winner ? [...list] : []));

  const points: [number, number] = [0, 0];
  counted.forEach((list, seat) => {
    points[seat % 2 as Team] += list.reduce((sum, a) => sum + a.points, 0);
  });
  belots.forEach((suits, seat) => {
    points[seat % 2 as Team] += suits.length * BELOT_POINTS;
  });

  return { counted, belots: belots.map((b) => [...b]), points };
}

/** Everything the hands hold, as if every player declared all of it (used by tests and by bots). */
export function resolveAnnouncements(hands: readonly (readonly Card[])[], contract: Contract): AnnouncementResult {
  return resolveDeclared(
    hands.map((h) => findAnnouncements(h)),
    hands.map((h) => findBelots(h, contract)),
  );
}

/** Whether `card` is a K or Q that completes the call of a belot the hand holds in `contract`. */
export function belotCallable(hand: readonly Card[], card: Card, contract: Contract): boolean {
  const partner = card.rank === "K" ? "Q" : card.rank === "Q" ? "K" : null;
  return partner !== null && findBelots(hand, contract).includes(card.suit) && hand.some((c) => c.suit === card.suit && c.rank === partner);
}

/**
 * Can this hand take every remaining trick for certain? True when each card in it beats every
 * card that has not been seen (the unseen cards sit in the other hands), so it wins whenever it
 * is led. Deliberately cautious: a plain-suit card only counts while no trump is left unseen.
 */
export function holdsAllRemainingTricks(hand: readonly Card[], seen: readonly Card[], contract: Contract): boolean {
  const known = [...hand, ...seen];
  const unseen = fullDeck().filter((c) => !known.some((k) => cardEquals(k, c)));
  const unseenTrumps = unseen.some((c) => isTrump(c, contract));
  return hand.every((card) => {
    if (unseen.some((u) => u.suit === card.suit && strength(u, contract) > strength(card, contract))) return false;
    return isTrump(card, contract) || !unseenTrumps;
  });
}
