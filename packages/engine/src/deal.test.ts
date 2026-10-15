import { describe, expect, it } from "vitest";
import { dealFirst, dealRest, nextSeat, shuffledDeck } from "./deal";

const key = (c: { suit: string; rank: string }) => c.suit + c.rank;

describe("shuffledDeck", () => {
  it("is deterministic per seed and differs between seeds", () => {
    expect(shuffledDeck(1)).toEqual(shuffledDeck(1));
    expect(shuffledDeck(1)).not.toEqual(shuffledDeck(2));
  });

  it("always contains the 32 distinct cards", () => {
    expect(new Set(shuffledDeck(42).map(key)).size).toBe(32);
  });
});

describe("dealing", () => {
  it("gives 5 cards each, then 8 each, using every card once", () => {
    const dealer = 2;
    const { hands, rest } = dealFirst(shuffledDeck(7), dealer);
    expect(hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(rest).toHaveLength(12);

    const full = dealRest(hands, rest, dealer);
    expect(full.map((h) => h.length)).toEqual([8, 8, 8, 8]);
    expect(new Set(full.flat().map(key)).size).toBe(32);
  });

  it("starts with the player after the dealer", () => {
    const deck = shuffledDeck(3);
    const { hands } = dealFirst(deck, 3);
    expect(hands[0]!.slice(0, 3)).toEqual(deck.slice(0, 3));
  });

  it("does not mutate the first-deal hands", () => {
    const { hands, rest } = dealFirst(shuffledDeck(5), 0);
    dealRest(hands, rest, 0);
    expect(hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
  });
});

describe("nextSeat", () => {
  it("wraps around", () => {
    expect(nextSeat(3)).toBe(0);
    expect(nextSeat(0)).toBe(1);
  });
});
