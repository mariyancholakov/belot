import { describe, expect, it } from "vitest";
import { applyAction, newGame, type GameState } from "./game";
import { chooseBotAction } from "./bot";

describe("bot", () => {
  it("plays whole games with legal moves only", () => {
    for (let seed = 1; seed <= 20; seed++) {
      let state: GameState = newGame(seed);
      let steps = 0;
      while (state.phase !== "gameOver") {
        const seat = state.phase === "roundEnd" ? 0 : state.turn;
        const action = chooseBotAction(state, seat);
        expect(action).not.toBeNull();
        const result = applyAction(state, seat, action!);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        state = result.state;
        expect(++steps).toBeLessThan(5000);
      }
      expect(state.winner).not.toBeNull();
    }
  });
});
