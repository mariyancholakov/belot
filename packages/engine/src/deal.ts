import { fullDeck, type Card } from "./cards";

export const SEATS = 4;

export function nextSeat(seat: number): number {
  return (seat + 1) % SEATS;
}

/** Small deterministic PRNG so a seed fully reproduces a game. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle of a fresh 32-card deck, fully determined by `seed`. */
export function shuffledDeck(seed: number): Card[] {
  const deck = fullDeck();
  const rand = mulberry32(seed);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

export interface FirstDeal {
  /** Hands indexed by seat, 5 cards each. */
  hands: Card[][];
  /** The 12 cards still to be dealt after bidding. */
  rest: Card[];
}

/** Deal 3 then 2 cards to each player, starting with the player after the dealer. */
export function dealFirst(deck: readonly Card[], dealer: number): FirstDeal {
  if (deck.length !== 32) throw new Error("deck must have 32 cards");
  const hands: Card[][] = [[], [], [], []];
  let index = 0;
  for (const count of [3, 2]) {
    for (let i = 1; i <= SEATS; i++) {
      const seat = (dealer + i) % SEATS;
      hands[seat]!.push(...deck.slice(index, index + count));
      index += count;
    }
  }
  return { hands, rest: deck.slice(index) };
}

/** Deal the remaining 3 cards to each player once bidding is over. */
export function dealRest(hands: readonly (readonly Card[])[], rest: readonly Card[], dealer: number): Card[][] {
  if (rest.length !== 12) throw new Error("expected 12 remaining cards");
  const result = hands.map((h) => [...h]);
  let index = 0;
  for (let i = 1; i <= SEATS; i++) {
    const seat = (dealer + i) % SEATS;
    result[seat]!.push(...rest.slice(index, index + 3));
    index += 3;
  }
  return result;
}
