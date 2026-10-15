export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  suit: Suit;
  rank: Rank;
}

/** What is trump this round. */
export type Contract = Suit | "no-trumps" | "all-trumps";

/** Trick-taking strength, higher wins. Index = strength. */
const TRUMP_ORDER: readonly Rank[] = ["7", "8", "Q", "K", "10", "A", "9", "J"];
const PLAIN_ORDER: readonly Rank[] = ["7", "8", "9", "J", "Q", "K", "10", "A"];

const TRUMP_POINTS: Record<Rank, number> = {
  "7": 0, "8": 0, "9": 14, "10": 10, J: 20, Q: 3, K: 4, A: 11,
};
const PLAIN_POINTS: Record<Rank, number> = {
  "7": 0, "8": 0, "9": 0, "10": 10, J: 2, Q: 3, K: 4, A: 11,
};

export function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function isTrump(card: Card, contract: Contract): boolean {
  if (contract === "all-trumps") return true;
  if (contract === "no-trumps") return false;
  return card.suit === contract;
}

/** Strength of a card when compared with another card of the same suit. */
export function strength(card: Card, contract: Contract): number {
  const order = isTrump(card, contract) ? TRUMP_ORDER : PLAIN_ORDER;
  return order.indexOf(card.rank);
}

export function points(card: Card, contract: Contract): number {
  return isTrump(card, contract) ? TRUMP_POINTS[card.rank] : PLAIN_POINTS[card.rank];
}

export function fullDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}
