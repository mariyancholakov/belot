import { describe, expect, it } from "vitest";
import type { Card, Contract } from "./cards";
import { mulberry32 } from "./deal";
import { knowledgeOf, sampleHands } from "./knowledge";
import { cardIndex, maskOf, popcount, SUIT_MASK } from "./sim";
import type { Play } from "./tricks";
import type { GameView } from "./view";

const card = (s: string): Card => ({
  suit: ({ c: "clubs", d: "diamonds", h: "hearts", s: "spades" } as const)[s.at(-1) as "c" | "d" | "h" | "s"],
  rank: s.slice(0, -1) as Card["rank"],
});
const bit = (s: string) => 1 << cardIndex(card(s));

/** A play-phase view for seat 0 with the given round so far (tricks led by `leaders`). */
function viewWith(contract: string, hand: string[], tricks: [number, string[]][], extra: Partial<GameView> = {}): GameView {
  const plays: Play[] = tricks.flatMap(([leader, cards]) => cards.map((c, i) => ({ seat: (leader + i) % 4, card: card(c) })));
  const counts = [0, 1, 2, 3].map((seat) => 8 - plays.filter((p) => p.seat === seat).length);
  counts[0] = hand.length;
  return {
    seat: 0,
    hand: hand.map(card),
    plays,
    trick: plays.slice(plays.length - (plays.length % 4)),
    handCounts: counts,
    contract: { bidder: 0, contract: contract as Contract, multiplier: 1 },
    lucky: null,
    announcements: null,
    belots: [[], [], [], []],
    declared: [[], [], [], []],
    ...extra,
  } as GameView;
}

describe("knowledge", () => {
  it("marks a seat that does not follow suit as void in it", () => {
    const k = knowledgeOf(viewWith("no-trumps", ["7c", "8c", "9c", "10c", "Jc", "Qc", "Kc"], [[0, ["Ac", "7d", "8h", "9s"]]]));
    for (const seat of [1, 2, 3]) expect(k.cannot[seat]! & SUIT_MASK[0]!).toBe(SUIT_MASK[0]!);
  });

  it("in a suit contract, a seat that throws a plain card against the opponents has no trumps", () => {
    // Hearts trump. Seat 1 leads clubs, seat 2 (an opponent of seat 1) throws a diamond: no hearts.
    const k = knowledgeOf(viewWith("hearts", ["7s", "8s", "9s", "10s", "Js", "Qs", "Ks"], [[1, ["Ac", "7d"]]]));
    expect(k.cannot[2]! & SUIT_MASK[2]!).toBe(SUIT_MASK[2]!);
  });

  it("a seat that throws a plain card over an opponent's trump only has no higher trump", () => {
    // Hearts trump. Seat 1 leads clubs, seat 2 trumps with the 9, seat 3 throws a diamond: no J of hearts, but maybe low ones.
    const k = knowledgeOf(viewWith("hearts", ["7s", "8s", "9s", "10s", "Js", "Qs", "Ks"], [[1, ["Ac", "9h", "7d"]]]));
    expect(k.cannot[3]! & bit("Jh")).not.toBe(0);
    expect(k.cannot[3]! & bit("7h")).toBe(0);
  });

  it("a seat may throw anything while its partner wins", () => {
    // Seat 1 leads the ace of clubs; its partner, seat 3, throws a diamond: nothing about trumps.
    const k = knowledgeOf(viewWith("hearts", ["7s", "8s", "9s", "10s", "Js", "Qs", "Ks"], [[1, ["Ac", "7d", "7h"]], [3, []]]));
    expect(k.cannot[3]! & SUIT_MASK[2]!).toBe(0);
    expect(k.cannot[3]! & SUIT_MASK[0]!).toBe(SUIT_MASK[0]!);
  });

  it("a seat that plays under the best trump holds nothing higher", () => {
    // All trumps. Seat 1 leads the 9 of spades, seat 2 follows with the 7: it has no J of spades.
    const k = knowledgeOf(viewWith("all-trumps", ["7h", "8h", "9h", "10h", "Jh", "Qh", "Kh"], [[1, ["9s", "7s"]]]));
    expect(k.cannot[2]! & bit("Js")).not.toBe(0);
    expect(k.cannot[2]! & bit("As")).toBe(0);
  });

  it("knows the other half of a called belot and the cards of shown announcements", () => {
    const k = knowledgeOf(
      viewWith("hearts", ["7s", "8s", "9s", "10s", "Js", "Qs", "Ks"], [[1, ["Kh"]]], {
        belots: [[], ["hearts"], [], []],
        announcements: [{ seat: 3, announcements: [{ kind: "terca", points: 20, suit: "clubs", high: "9", cards: ["7c", "8c", "9c"].map(card) }] }],
      }),
    );
    expect(k.holds[1]).toBe(bit("Qh"));
    expect(k.holds[3]).toBe(maskOf(["7c", "8c", "9c"].map(card)));
    expect(k.cannot[2]! & bit("Qh")).not.toBe(0);
  });

  it("samples deals that fit everything known", () => {
    const view = viewWith("hearts", ["7s", "8s", "9s", "10s", "Js", "Qs", "Ks"], [[1, ["Ac", "7d", "8c", "9c"]], [1, ["Kh"]]], {
      belots: [[], ["hearts"], [], []],
    });
    const k = knowledgeOf(view);
    const rand = mulberry32(1);
    for (let n = 0; n < 200; n++) {
      const hands = sampleHands(k, maskOf(view.hand), rand);
      expect(hands.map(popcount)).toEqual(view.handCounts);
      expect(hands[1]! & bit("Qh")).not.toBe(0);
      expect(hands[2]! & (SUIT_MASK[0]! | SUIT_MASK[2]!)).toBe(0);
      expect(hands[0]! | hands[1]! | hands[2]! | hands[3]! | maskOf(view.plays.map((p) => p.card))).toBe(-1);
    }
  });
});
