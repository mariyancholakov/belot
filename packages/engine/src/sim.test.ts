import { describe, expect, it } from "vitest";
import { findAnnouncements, resolveDeclared } from "./announcements";
import { fullDeck, type Card } from "./cards";
import { mulberry32, shuffledDeck } from "./deal";
import { applyAction, mustDecideAnnouncements, newGame, type GameAction, type GameState } from "./game";
import {
  announcementPoints,
  callsBelot,
  cardIndex,
  cardOf,
  cardsOf,
  CONTRACTS,
  contractId,
  greedyPolicy,
  legalNow,
  maskOf,
  playCard,
  playOut,
  popcount,
  roundResult,
  startRound,
  type SimRound,
} from "./sim";
import { legalPlays } from "./tricks";

function step(state: GameState, seat: number, action: GameAction): GameState {
  const r = applyAction(state, seat, action);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe("sim", () => {
  it("numbers cards and counts masks", () => {
    for (let i = 0; i < 32; i++) expect(cardIndex(cardOf(i))).toBe(i);
    expect(popcount(-1)).toBe(32);
    expect(popcount(0b1011)).toBe(3);
    expect(cardsOf(maskOf([{ suit: "spades", rank: "A" }]))).toEqual([{ suit: "spades", rank: "A" }]);
  });

  it("agrees with the engine on legal cards and the round score", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const rand = mulberry32(seed * 31);
      let state = newGame(seed);
      let sim: SimRound | null = null;
      while (state.history.length === 0) {
        const seat = state.turn;
        if (state.phase === "cutting") state = step(state, seat, { type: "cut", position: 5 });
        else if (state.phase === "dealing") state = step(state, seat, { type: "deal", lucky: false });
        else if (state.phase === "shuffling") state = step(state, seat, { type: "shuffle" });
        else if (state.phase === "bidding") {
          const bids = state.bidding.highest ? [{ type: "pass" as const }] : [{ type: "bid" as const, contract: (["clubs", "hearts", "no-trumps", "all-trumps"] as const)[seed % 4]! }];
          state = step(state, seat, { type: "bid", bid: bids[0]! });
        } else if (state.phase === "playing") {
          const c = state.contract!;
          if (!sim) {
            const declared = state.hands.map((h) => findAnnouncements(h, c.contract));
            sim = startRound(state.hands.map(maskOf), contractId(c.contract), c.bidder, state.dealer, c.multiplier, resolveDeclared(declared, [[], [], [], []]).points);
          }
          if (mustDecideAnnouncements(state, seat)) {
            state = step(state, seat, { type: "announce", declare: true });
            continue;
          }
          const legal = legalPlays(state.hands[seat]!, state.trick, c.contract, seat);
          expect(sim.turn).toBe(seat);
          expect(legalNow(sim)).toBe(maskOf(legal));
          const card = legal[Math.floor(rand() * legal.length)]!;
          playCard(sim, cardIndex(card));
          state = step(state, seat, { type: "play", card, belot: true });
        }
      }
      expect(sim).not.toBeNull();
      expect(roundResult(sim!)).toEqual(state.history[0]!.result);
      expect(sim!.points).toEqual(state.history[0]!.cardPoints);
    }
  });
});

describe("greedy playout", () => {
  it("plays a dealt round to the end with every card point taken", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const deck = shuffledDeck(seed).map(cardIndex);
      const hands = [0, 1, 2, 3].map((s) => deck.slice(s * 8, s * 8 + 8).reduce((m, i) => m | (1 << i), 0));
      for (const c of [0, 4, 5]) {
        const r = playOut(startRound(hands, c, 1, 0), greedyPolicy);
        expect(r.points[0] + r.points[1]).toBe([162, 162, 162, 162, 130, 258][c]);
        expect(r.hands.every((h) => h === 0)).toBe(true);
      }
    }
  });
});

describe("announcement points", () => {
  it("match the engine when everybody declares", () => {
    const rand = mulberry32(5);
    for (let n = 0; n < 3000; n++) {
      // Hands biased towards runs and carrés: deal from a deck that keeps a few suits whole.
      const deck = n % 2 ? shuffledDeck(n) : fullDeck().sort(() => rand() - 0.5).sort((a, b) => (rand() < 0.7 ? 0 : a.suit.localeCompare(b.suit)));
      const hands = [0, 1, 2, 3].map((s) => deck.slice(s * 8, s * 8 + 8));
      for (const c of [0, 4, 5]) {
        const expected = resolveDeclared(hands.map((h) => findAnnouncements(h, CONTRACTS[c]!)), [[], [], [], []]).points;
        expect(announcementPoints(hands.map(maskOf), c)).toEqual(expected);
      }
    }
  });
});

describe("belot in the simulation", () => {
  const i = (rank: Card["rank"], suit: Card["suit"]) => cardIndex({ rank, suit });
  const hand = (suit: Card["suit"]) => maskOf([{ rank: "K", suit }, { rank: "Q", suit }, { rank: "7", suit: "diamonds" }]);

  it("is called leading or following the led suit, never on another suit's trick", () => {
    const hearts = contractId("hearts");
    expect(callsBelot(hand("hearts"), i("K", "hearts"), hearts, [])).toBe(true);
    expect(callsBelot(hand("hearts"), i("Q", "hearts"), hearts, [i("7", "hearts")])).toBe(true);
    expect(callsBelot(hand("hearts"), i("K", "hearts"), hearts, [i("7", "spades")])).toBe(false);
    expect(callsBelot(hand("clubs"), i("K", "clubs"), hearts, [])).toBe(false);
    const all = contractId("all-trumps");
    expect(callsBelot(hand("clubs"), i("K", "clubs"), all, [])).toBe(true);
    expect(callsBelot(hand("clubs"), i("K", "clubs"), all, [i("9", "spades")])).toBe(false);
  });
});
