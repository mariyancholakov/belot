import { describe, expect, it } from "vitest";
import { netInputs, netValue, type NetWeights } from "./handNet";
import { maskOf } from "./sim";
import type { Card } from "./cards";

const card = (s: string): Card => ({
  suit: ({ c: "clubs", d: "diamonds", h: "hearts", s: "spades" } as const)[s.at(-1) as "c" | "d" | "h" | "s"],
  rank: s.slice(0, -1) as Card["rank"],
});
const hand = (...cards: string[]) => maskOf(cards.map(card));

describe("hand network inputs", () => {
  it("put the trump suit first and order the other suits by their cards", () => {
    // Hearts trump (2): J and 9 of hearts in slots 4 and 2; then spades (ace), diamonds (8), clubs (7).
    expect(netInputs(hand("Jh", "9h", "As", "7c", "8d"), 2, 1)).toEqual([2, 4, 15, 17, 24, 33]);
  });

  it("are the same for hands that differ only by swapping alike suits", () => {
    expect(netInputs(hand("Jh", "As", "Kc"), 2, 0)).toEqual(netInputs(hand("Jh", "Ac", "Ks"), 2, 0));
    expect(netInputs(hand("Jh", "Js", "9c"), 5, 3)).toEqual(netInputs(hand("Jd", "Jc", "9s"), 5, 3));
  });
});

describe("hand network", () => {
  it("adds the active inputs' weights and passes them through ReLU units", () => {
    // Two hidden units; input 0 feeds unit 0 by 2, input 1 feeds unit 1 by -5 (cut to 0 by the ReLU).
    const w1 = new Array(36 * 2).fill(0);
    w1[0] = 2;
    w1[3] = -5;
    const net: NetWeights = { hidden: 2, w1, b1: [1, 1], w2: [3, 7], b2: 0.5 };
    expect(netValue(net, [0, 1])).toBe(0.5 + 3 * (1 + 2));
  });
});
