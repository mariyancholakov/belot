import { describe, expect, it } from "vitest";
import { applyAction, cutterOf, legalActions, newGame, type GameAction, type GameState } from "./game";

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

/** A new game with the deck already cut, so it is ready for bidding. */
function startedGame(seed: number, dealer = 0, position = 16, lucky = false): GameState {
  return dealCut(newGame(seed, dealer), position, lucky);
}

/** Cut the deck and deal, from whatever state is waiting for the cut. */
function dealCut(s: GameState, position = 16, lucky = false): GameState {
  const cut = applyAction(s, cutterOf(s.dealer), { type: "cut", position });
  if (!cut.ok) throw new Error(cut.error);
  const dealt = applyAction(cut.state, s.dealer, { type: "deal", lucky });
  if (!dealt.ok) throw new Error(dealt.error);
  return dealt.state;
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
  it("starts by waiting for the player right of the dealer to cut", () => {
    const s = newGame(1);
    expect(s.phase).toBe("cutting");
    expect(s.turn).toBe(3); // the dealer's left
    expect(s.hands.map((h) => h.length)).toEqual([0, 0, 0, 0]);
    expect(applyAction(s, 1, { type: "cut", position: 10 }).ok).toBe(false);
    expect(applyAction(s, 3, { type: "cut", position: 0 }).ok).toBe(false);
    expect(applyAction(s, 3, { type: "cut", position: 32 }).ok).toBe(false);
    expect(applyAction(s, 3, { type: "bid", bid: { type: "pass" } }).ok).toBe(false);
  });

  it("the cut changes which cards are dealt but keeps the same 32", () => {
    const a = startedGame(1, 0, 5);
    const b = startedGame(1, 0, 20);
    expect(a.hands).not.toEqual(b.hands);
    const all = (s: GameState) => [...s.hands.flat(), ...s.talon].map((c) => c.suit + c.rank).sort();
    expect(all(a)).toEqual(all(b));
    expect(all(a)).toHaveLength(32);
  });

  it("starts in bidding with 5 cards each after the cut", () => {
    const s = startedGame(1);
    expect(s.phase).toBe("bidding");
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(s.turn).toBe(1);
  });

  it("rejects actions out of turn and wrong-phase actions", () => {
    const s = startedGame(1);
    expect(applyAction(s, 3, { type: "bid", bid: { type: "pass" } }).ok).toBe(false);
    expect(applyAction(s, 1, { type: "play", card: s.hands[1]![0]! }).ok).toBe(false);
    expect(applyAction(s, 1, { type: "nextRound" }).ok).toBe(false);
  });

  it("does not mutate the previous state", () => {
    const s = startedGame(1);
    const copy = structuredClone(s);
    applyAction(s, 1, { type: "bid", bid: { type: "bid", contract: "hearts" } });
    expect(s).toEqual(copy);
  });

  it("deals the other 3 cards to each player when bidding ends", () => {
    let s = startedGame(1);
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
    let s = startedGame(1);
    const before = s.hands;
    for (const seat of [1, 2, 3, 0]) {
      const r = applyAction(s, seat, { type: "bid", bid: { type: "pass" } });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.phase).toBe("cutting");
    expect(s.dealer).toBe(1);
    expect(s.turn).toBe(0);
    const cut = applyAction(s, 0, { type: "cut", position: 16 });
    if (!cut.ok) throw new Error(cut.error);
    expect(cut.state.phase).toBe("dealing");
    const dealt = applyAction(cut.state, 1, { type: "deal", lucky: false });
    if (!dealt.ok) throw new Error(dealt.error);
    expect(dealt.state.phase).toBe("bidding");
    expect(dealt.state.hands).not.toEqual(before);
  });

  it("keeps the same deck after everybody passes and the previous dealer cuts", () => {
    let s = startedGame(1);
    const deckBefore = s.deck.map((c) => c.suit + c.rank);
    for (const seat of [1, 2, 3, 0]) {
      const r = applyAction(s, seat, { type: "bid", bid: { type: "pass" } });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.phase).toBe("cutting");
    expect(s.deck.map((c) => c.suit + c.rank)).toEqual(deckBefore);
    expect(s.fresh).toBe(false);
    expect(s.allPassStreak).toBe(1);
    expect(applyAction(s, 1, { type: "shuffle" }).ok).toBe(false);
  });

  it("offers the dealer a shuffle only after three all-pass deals in a row", () => {
    let s = startedGame(2);
    const passRound = () => {
      for (let i = 0; i < 4; i++) {
        const r = applyAction(s, s.turn, { type: "bid", bid: { type: "pass" } });
        if (!r.ok) throw new Error(r.error);
        s = r.state;
      }
    };
    passRound();
    s = dealCut(s);
    passRound();
    s = dealCut(s);
    expect(s.allPassStreak).toBe(2);
    passRound();
    expect(s.allPassStreak).toBe(3);
    expect(s.phase).toBe("shuffling");
    expect(s.turn).toBe(s.dealer);
    const deckBefore = s.deck.map((c) => c.suit + c.rank);
    expect(applyAction(s, (s.dealer + 1) % 4, { type: "shuffle" }).ok).toBe(false);
    const r = applyAction(s, s.dealer, { type: "shuffle" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.phase).toBe("cutting");
    expect(r.state.fresh).toBe(true);
    expect(r.state.allPassStreak).toBe(0);
    expect(r.state.deck.map((c) => c.suit + c.rank)).not.toEqual(deckBefore);
    expect(r.events).toEqual([{ type: "shuffled", seat: s.dealer }]);
    // Declining keeps the deck and goes straight to the cut.
    const skip = applyAction(s, s.dealer, { type: "skipShuffle" });
    if (!skip.ok) throw new Error(skip.error);
    expect(skip.state.phase).toBe("cutting");
    expect(skip.state.deck.map((c) => c.suit + c.rank)).toEqual(deckBefore);
  });

  it("does not reshuffle between rounds: the next deck is the played cards in order", () => {
    let s = startedGame(3);
    const rand = rng(3);
    while (s.phase !== "roundEnd") {
      const pick = chooseAction(s, rand);
      const r = applyAction(s, pick.seat, pick.action);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      if (s.phase === "cutting") s = dealCut(s); // redeals before a contract is made
      if (s.phase === "gameOver") break;
    }
    if (s.phase !== "roundEnd") return;
    const played = s.collected.map((c) => c.suit + c.rank);
    expect(played).toHaveLength(32);
    const next = applyAction(s, 0, { type: "nextRound" });
    if (!next.ok) throw new Error(next.error);
    expect(next.state.deck.map((c) => c.suit + c.rank)).toEqual(played);
    expect(next.state.collected).toEqual([]);
    expect(next.state.phase).toBe("cutting");
    expect(next.state.fresh).toBe(false);
  });

  it("turns the first dealt card face up when the dealer asks for a lucky card", () => {
    const plain = startedGame(4, 0, 16, false);
    expect(plain.lucky).toBeNull();
    const lucky = startedGame(4, 0, 16, true);
    expect(lucky.lucky).toEqual({ seat: 1, card: lucky.hands[1]![0] });
    expect(lucky.hands).toEqual(plain.hands); // same deal, just revealed
    const cut = applyAction(newGame(4), 3, { type: "cut", position: 16 });
    if (!cut.ok) throw new Error(cut.error);
    expect(applyAction(cut.state, 3, { type: "deal", lucky: true }).ok).toBe(false); // only the dealer deals
  });

  it("is deterministic for a given seed", () => {
    expect(playGame(11)).toEqual(playGame(11));
  });
});

describe("belot call", () => {
  it("is announced once, when the first of K+Q of trump is played", () => {
    // Find a seed where someone holds K+Q of the bid suit, then play it out.
    for (let seed = 1; seed < 200; seed++) {
      let s = startedGame(seed);
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
