import { describe, expect, it } from "vitest";
import { chooseBid, DEFAULT_BID_TUNING } from "./bidder";
import type { Card, Contract } from "./cards";
import { applyAction, newGame, type GameAction, type GameState } from "./game";
import { viewFor } from "./view";

const card = (s: string): Card => ({
  suit: ({ c: "clubs", d: "diamonds", h: "hearts", s: "spades" } as const)[s.at(-1) as "c" | "d" | "h" | "s"],
  rank: s.slice(0, -1) as Card["rank"],
});

function must(state: GameState, seat: number, action: GameAction): GameState {
  const r = applyAction(state, seat, action);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

const pass: GameAction = { type: "bid", bid: { type: "pass" } };
const bid = (contract: Contract): GameAction => ({ type: "bid", bid: { type: "bid", contract } });

/** The bid `seat` makes holding `hand` after the given bids (dealer 0, so seat 1 bids first). */
function bidWith(hand: string[], before: GameAction[] = [], scores: [number, number] = [0, 0]): GameAction {
  let state = newGame(1);
  state.scores = scores;
  state = must(state, state.turn, { type: "cut", position: 5 });
  state = must(state, state.turn, { type: "deal", lucky: false });
  for (const action of before) state = must(state, state.turn, action);
  const seat = state.turn;
  state.hands[seat] = hand.map(card);
  return chooseBid(viewFor(state, seat), 1);
}

describe("bidding by simulation", () => {
  it("bids all trumps on three jacks", () => {
    expect(bidWith(["Js", "Jh", "Jd", "9s", "9h"])).toEqual(bid("all-trumps"));
  });

  it("bids no trumps on three aces", () => {
    expect(bidWith(["As", "Ah", "Ad", "10s", "10h"])).toEqual(bid("no-trumps"));
  });

  it("passes with nothing", () => {
    expect(bidWith(["7c", "8d", "7h", "8s", "9c"])).toEqual(pass);
  });

  it("doubles an opponent's trump suit it holds the top of", () => {
    expect(bidWith(["Jh", "9h", "Ah", "10h", "As"], [bid("hearts")])).toEqual({ type: "bid", bid: { type: "contra" } });
  });

  it("doubles with nothing when the opponents are about to win anyway", () => {
    // Seat 2 bids after seat 1's hearts; its team (0) is far behind and seat 1's team needs little.
    const weak = ["7c", "8d", "7h", "8s", "9c"];
    expect(bidWith(weak, [bid("hearts")], [80, 145])).toEqual({ type: "bid", bid: { type: "contra" } });
    expect(bidWith(weak, [bid("hearts")], [80, 100])).toEqual(pass);
  });

  it("always answers with a legal bid, the same one for the same seed", () => {
    let state = newGame(9);
    state = must(state, state.turn, { type: "cut", position: 5 });
    state = must(state, state.turn, { type: "deal", lucky: true });
    while (state.phase === "bidding") {
      const view = viewFor(state, state.turn);
      const action = chooseBid(view, 3);
      expect(chooseBid(view, 3)).toEqual(action);
      state = must(state, state.turn, action);
    }
  });
});

describe("bidding with the bid network", () => {
  it("answers with a legal bid when it reads the bids and plays the auction out with the network", () => {
    let state = newGame(4);
    state = must(state, state.turn, { type: "cut", position: 5 });
    state = must(state, state.turn, { type: "deal", lucky: false });
    const t = { ...DEFAULT_BID_TUNING, samples: 30, netInference: 1, netLookahead: 1 };
    while (state.phase === "bidding") {
      const view = viewFor(state, state.turn);
      const action = chooseBid(view, 5, t);
      expect(view.legalActions).toContainEqual(action);
      state = must(state, state.turn, action);
    }
  });
});
