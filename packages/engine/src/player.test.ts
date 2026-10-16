import { describe, expect, it } from "vitest";
import { BOTS, basicBot } from "./bot";
import { applyAction, newGame, type GameState } from "./game";
import { chooseCard, roundFromView } from "./player";
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
            const action = chooseCard(view, seed, { samples: 20, policy: (r, legal) => 31 - Math.clz32(legal) });
            expect(chooseCard(view, seed, { samples: 20, policy: (r, legal) => 31 - Math.clz32(legal) })).toEqual(action);
            expect(view.legalActions).toContainEqual(action);
          }
        }
        state = advance(state);
      }
    }
  });

  it("plays whole games", () => {
    const mc = BOTS.mc!({ samples: 10 });
    let state = newGame(4);
    for (let steps = 0; state.phase !== "gameOver"; steps++) {
      state = advance(state, mc);
      expect(steps).toBeLessThan(5000);
    }
  });
});
