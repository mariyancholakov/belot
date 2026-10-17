import { describe, expect, it } from "vitest";
import { applyAction, newGame, type GameState } from "./game";
import { BOT_LEVELS, BOTS, chooseBotAction, randomBot } from "./bot";
import { viewFor } from "./view";

describe("bot", () => {
  it("plays whole games with legal moves only", () => {
    for (let seed = 1; seed <= 4; seed++) {
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

  it("random bot picks only legal moves, the same one for the same seed", () => {
    let state: GameState = newGame(7);
    for (let step = 0; state.phase !== "gameOver"; step++) {
      const seat = state.phase === "roundEnd" ? 0 : state.turn;
      const view = viewFor(state, seat);
      const action = randomBot(view, step);
      expect(action).toEqual(randomBot(view, step));
      const result = applyAction(state, seat, action!);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      expect(step).toBeLessThan(20000);
    }
  });

  it("every difficulty level plays a round with legal moves", () => {
    for (const level of Object.keys(BOT_LEVELS)) {
      const bot = BOTS[level]!({ "bid.samples": 20, "play.samples": 5 });
      let state: GameState = newGame(3);
      while (state.history.length === 0) {
        const seat = state.phase === "roundEnd" ? 0 : state.turn;
        const action = bot(viewFor(state, seat), 1);
        expect(action).not.toBeNull();
        const result = applyAction(state, seat, action!);
        if (!result.ok) throw new Error(result.error);
        state = result.state;
      }
    }
  });
});
