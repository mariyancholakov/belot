import { describe, expect, it } from "vitest";
import { applyAction, legalActions, newGame, type GameAction, type GameState } from "./game";

/** Tiny seeded RNG for the test players. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seatToAct(state: GameState): number {
  if (state.phase === "roundEnd") return 0;
  return state.turn;
}

function chooseAction(state: GameState, rand: () => number): { seat: number; action: GameAction } {
  const seat = seatToAct(state);
  const options = legalActions(state, seat);
  expect(options.length).toBeGreaterThan(0);
  // Bias bidding towards passing so rounds actually get played.
  if (state.phase === "bidding") {
    const pass = options.find((o) => o.type === "bid" && o.bid.type === "pass")!;
    if (rand() < 0.6) return { seat, action: pass };
  }
  return { seat, action: options[Math.floor(rand() * options.length)]! };
}

function playGame(seed: number) {
  const rand = rng(seed * 7919 + 1);
  let state = newGame(seed, seed % 4);
  let steps = 0;
  while (state.phase !== "gameOver") {
    const { seat, action } = chooseAction(state, rand);
    const r = applyAction(state, seat, action);
    if (!r.ok) throw new Error(`seed ${seed} step ${steps}: ${r.error}`);
    expect(r.state.scores[0]).toBeGreaterThanOrEqual(state.scores[0]);
    expect(r.state.scores[1]).toBeGreaterThanOrEqual(state.scores[1]);
    state = r.state;
    if (++steps > 20000) throw new Error(`seed ${seed} did not finish`);
  }
  return state;
}

describe("game", () => {
  it("starts in bidding with 5 cards each", () => {
    const s = newGame(1);
    expect(s.phase).toBe("bidding");
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(s.turn).toBe(1);
  });

  it("rejects actions out of turn and wrong-phase actions", () => {
    const s = newGame(1);
    expect(applyAction(s, 3, { type: "bid", bid: { type: "pass" } }).ok).toBe(false);
    expect(applyAction(s, 1, { type: "play", card: s.hands[1]![0]! }).ok).toBe(false);
    expect(applyAction(s, 1, { type: "nextRound" }).ok).toBe(false);
  });

  it("does not mutate the previous state", () => {
    const s = newGame(1);
    const copy = structuredClone(s);
    applyAction(s, 1, { type: "bid", bid: { type: "bid", contract: "hearts" } });
    expect(s).toEqual(copy);
  });

  it("deals the other 3 cards to each player when bidding ends", () => {
    let s = newGame(1);
    const moves: [number, GameAction][] = [
      [1, { type: "bid", bid: { type: "bid", contract: "hearts" } }],
      [2, { type: "bid", bid: { type: "pass" } }],
      [3, { type: "bid", bid: { type: "pass" } }],
      [0, { type: "bid", bid: { type: "pass" } }],
    ];
    for (const [seat, a] of moves) {
      const r = applyAction(s, seat, a);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.phase).toBe("playing");
    expect(s.hands.map((h) => h.length)).toEqual([8, 8, 8, 8]);
    expect(s.turn).toBe(1); // player after the dealer leads
    expect(s.contract).toEqual({ bidder: 1, contract: "hearts", multiplier: 1 });
  });

  it("four passes redeal with the next dealer and a new shuffle", () => {
    let s = newGame(1);
    const before = s.hands;
    for (const seat of [1, 2, 3, 0]) {
      const r = applyAction(s, seat, { type: "bid", bid: { type: "pass" } });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.phase).toBe("bidding");
    expect(s.dealer).toBe(1);
    expect(s.hands).not.toEqual(before);
  });

  it("is deterministic for a given seed", () => {
    expect(playGame(11)).toEqual(playGame(11));
  });
});

describe("belot call", () => {
  it("is announced once, when the first of K+Q of trump is played", () => {
    // Find a seed where someone holds K+Q of the bid suit, then play it out.
    for (let seed = 1; seed < 200; seed++) {
      let s = newGame(seed);
      const bid = (seat: number, b: GameAction) => {
        const r = applyAction(s, seat, b);
        if (!r.ok) throw new Error(r.error);
        s = r.state;
      };
      bid(1, { type: "bid", bid: { type: "bid", contract: "hearts" } });
      for (const seat of [2, 3, 0]) bid(seat, { type: "bid", bid: { type: "pass" } });
      const holder = s.hands.findIndex(
        (h) => h.some((c) => c.suit === "hearts" && c.rank === "K") && h.some((c) => c.suit === "hearts" && c.rank === "Q"),
      );
      if (holder < 0) continue;

      const rand = rng(seed);
      const belots: number[] = [];
      while (s.phase === "playing") {
        const options = legalActions(s, s.turn);
        const r = applyAction(s, s.turn, options[Math.floor(rand() * options.length)]!);
        if (!r.ok) throw new Error(r.error);
        belots.push(...r.events.flatMap((e) => (e.type === "belot" ? [e.seat] : [])));
        s = r.state;
      }
      expect(belots).toEqual([holder]);
      return;
    }
    throw new Error("no seed with a belot found");
  });
});

describe("random playouts", () => {
  it("300 seeded games always finish with a winner and consistent points", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const state = playGame(seed);
      expect(state.winner).not.toBeNull();
      expect(Math.max(...state.scores)).toBeGreaterThanOrEqual(151);

      for (const round of state.history) {
        const total = round.cardPoints[0] + round.cardPoints[1];
        const expected = round.contract === "all-trumps" ? 258 : round.contract === "no-trumps" ? 130 : 162;
        expect(total).toBe(expected);
      }
    }
  });
});
