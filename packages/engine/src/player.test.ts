import { describe, expect, it } from "vitest";
import { BOTS, basicBot } from "./bot";
import { applyAction, newGame, type GameState } from "./game";
import { mulberry32 } from "./deal";
import { knowledgeOf } from "./knowledge";
import { chooseCard, DEFAULT_PLAY_TUNING, roundFromView, sampleDeals } from "./player";
import { contractId, maskOf, popcount, SUIT_MASK } from "./sim";
import { viewFor } from "./view";

function advance(state: GameState, bot = basicBot): GameState {
  const seat = state.phase === "roundEnd" ? 0 : state.turn;
  const r = applyAction(state, seat, bot(viewFor(state, seat), 1)!);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe("card play by sampling", () => {
  it("rebuilds the round's points and tricks from a seat's view", () => {
    for (let seed = 1; seed <= 30; seed++) {
      let state = newGame(seed);
      while (state.phase !== "playing" || state.tricksPlayed < 3) state = advance(state);
      const r = roundFromView(viewFor(state, state.turn));
      expect(r.points).toEqual(state.cardPoints);
      expect(r.tricks).toEqual(state.tricksWon);
      expect(r.tricksPlayed).toBe(3);
    }
  });

  it("plays only legal cards, the same one for the same seed", () => {
    for (let seed = 1; seed <= 6; seed++) {
      let state = newGame(seed);
      while (state.history.length === 0) {
        if (state.phase === "playing") {
          const view = viewFor(state, state.turn);
          if (view.legalActions.some((a) => a.type === "play")) {
            const action = chooseCard(view, seed, { ...DEFAULT_PLAY_TUNING, samples: 20, policy: (r, legal) => 31 - Math.clz32(legal) });
            expect(chooseCard(view, seed, { ...DEFAULT_PLAY_TUNING, samples: 20, policy: (r, legal) => 31 - Math.clz32(legal) })).toEqual(action);
            expect(view.legalActions).toContainEqual(action);
          }
        }
        state = advance(state);
      }
    }
  });

  it("plays whole games", () => {
    const mc = BOTS.mc!({ "bid.samples": 30, "play.samples": 10 });
    let state = newGame(4);
    for (let steps = 0; state.phase !== "gameOver"; steps++) {
      state = advance(state, mc);
      expect(steps).toBeLessThan(5000);
    }
  });

  it("weighs the deals by the bids: a seat that bid a suit holds more of it", () => {
    let checked = 0;
    for (let seed = 1; checked < 5 && seed < 200; seed++) {
      let state = newGame(seed);
      while (state.phase !== "playing") state = advance(state);
      const view = viewFor(state, state.turn);
      const bidder = view.contract!.bidder;
      const c = contractId(view.contract!.contract);
      if (bidder === view.seat || c > 3) continue;
      const k = knowledgeOf(view);
      const count = (bids: number) => {
        const deals = sampleDeals(view, k, maskOf(view.hand), [0, 0, 0, 0], mulberry32(seed), { ...DEFAULT_PLAY_TUNING, samples: 400, bids, pool: 6 });
        expect(deals).toHaveLength(400);
        return deals.reduce((n, hands) => n + popcount(hands[bidder]! & SUIT_MASK[c]!), 0);
      };
      expect(count(1)).toBeGreaterThan(count(0));
      checked++;
    }
    expect(checked).toBe(5);
  });
});
