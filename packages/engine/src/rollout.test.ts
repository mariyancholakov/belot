import { describe, expect, it } from "vitest";
import { shuffledDeck } from "./deal";
import { cardIndex, legalNow, maskOf, playCard, playOut, roundOver, startRound, type SimRound } from "./sim";
import { POLICIES, smartPolicy } from "./rollout";

const hand = (...cards: string[]) =>
  maskOf(cards.map((c) => ({ rank: c.slice(0, -1), suit: { c: "clubs", d: "diamonds", h: "hearts", s: "spades" }[c.at(-1)!]! }) as never));
const card = (c: string) => 31 - Math.clz32(hand(c));

describe("rollout policies", () => {
  it("play only legal cards and finish every round", () => {
    for (const policy of POLICIES) {
      for (let seed = 1; seed <= 40; seed++) {
        const deck = shuffledDeck(seed).map(cardIndex);
        const hands = [0, 1, 2, 3].map((s) => deck.slice(s * 8, s * 8 + 8).reduce((m, i) => m | (1 << i), 0));
        for (let c = 0; c < 6; c++) {
          const r = startRound(hands, c, seed % 4, 0);
          while (!roundOver(r)) {
            const legal = legalNow(r);
            const pick = policy(r, legal);
            expect(legal & (1 << pick)).not.toBe(0);
            playCard(r, pick);
          }
          expect(r.points[0] + r.points[1]).toBe([162, 162, 162, 162, 130, 258][c]);
        }
      }
    }
  });

  it("smart: pulls trumps with a master trump for the bidding side, leads a sure plain winner otherwise", () => {
    // Hearts (2) are trumps; seat 1 leads.
    const hands = [hand("7c", "8c"), hand("Jh", "Ac", "7d"), hand("9h", "8d"), hand("10h", "9d")];
    const round = (bidder: number): SimRound => ({ ...startRound(hands, 2, bidder, 0), tricksPlayed: 6 });
    expect(smartPolicy(round(1), hands[1]!)).toBe(card("Jh"));
    expect(smartPolicy(round(0), hands[1]!)).toBe(card("Ac"));
  });

  it("smart: feeds points to a partner sure to win, keeps them from one who may lose", () => {
    // No trumps, seat 0 leads; seat 2 is its partner and gives the king only when the trick is safe.
    const deal = (lead: string) => startRound([hand(lead), hand("8c"), hand("Kc", "7c"), hand("10c", "Qc")], 4, 0, 3);
    const sure = deal("Ac");
    playCard(sure, card("Ac"));
    playCard(sure, card("8c"));
    expect(smartPolicy(sure, legalNow(sure))).toBe(card("Kc"));
    const unsure = deal("9c");
    playCard(unsure, card("9c"));
    playCard(unsure, card("8c"));
    expect(smartPolicy(unsure, legalNow(unsure))).toBe(card("7c"));
  });

  it("smart plays a whole round from a deal", () => {
    const deck = shuffledDeck(3).map(cardIndex);
    const hands = [0, 1, 2, 3].map((s) => deck.slice(s * 8, s * 8 + 8).reduce((m, i) => m | (1 << i), 0));
    expect(roundOver(playOut(startRound(hands, 5, 0, 0), smartPolicy))).toBe(true);
  });
});
