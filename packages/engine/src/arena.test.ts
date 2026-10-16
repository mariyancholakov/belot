import { describe, expect, it } from "vitest";
import { playGame, playRound } from "./arena";
import { basicBot, randomBot, type BotPolicy } from "./bot";

describe("arena", () => {
  it("is deterministic for a seed", () => {
    expect(playRound([basicBot, randomBot], 3)).toEqual(playRound([basicBot, randomBot], 3));
    expect(playGame([randomBot, basicBot], 3)).toEqual(playGame([randomBot, basicBot], 3));
  });

  it("deals the same cards whoever sits where", () => {
    const firstHands = (lineup: [BotPolicy, BotPolicy]) => {
      let hands: string | null = null;
      const spy: BotPolicy = (view, seed) => {
        if (view.phase === "bidding" && view.bidLog.length === 0 && hands === null) hands = JSON.stringify(view.hand);
        return (view.seat % 2 === 0 ? lineup[0] : lineup[1])(view, seed);
      };
      playRound([spy, spy], 11);
      return hands;
    };
    expect(firstHands([basicBot, randomBot])).toBe(firstHands([randomBot, basicBot]));
  });

  it("basic bot clearly beats random moves", () => {
    let margin = 0;
    for (let seed = 1; seed <= 100; seed++) {
      for (const [a, lineup] of [[0, [basicBot, randomBot]], [1, [randomBot, basicBot]]] as const) {
        const r = playRound(lineup, seed);
        margin += r.result.recorded[a] - r.result.recorded[1 - a]!;
      }
    }
    expect(margin / 200).toBeGreaterThan(8);
  });
});
