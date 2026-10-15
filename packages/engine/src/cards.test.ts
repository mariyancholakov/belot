import { describe, expect, it } from "vitest";
import { fullDeck, points, strength, type Card, type Contract } from "./cards";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

describe("cards", () => {
  it("has 32 unique cards", () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(32);
    expect(new Set(deck.map((x) => x.suit + x.rank)).size).toBe(32);
  });

  it("ranks trump J > 9 > A > 10 > K > Q > 8 > 7", () => {
    const order = ["J", "9", "A", "10", "K", "Q", "8", "7"] as const;
    for (let i = 0; i < order.length - 1; i++) {
      expect(strength(c(order[i]!, "hearts"), "hearts")).toBeGreaterThan(
        strength(c(order[i + 1]!, "hearts"), "hearts"),
      );
    }
  });

  it("ranks plain A > 10 > K > Q > J > 9 > 8 > 7", () => {
    const order = ["A", "10", "K", "Q", "J", "9", "8", "7"] as const;
    for (let i = 0; i < order.length - 1; i++) {
      expect(strength(c(order[i]!, "clubs"), "hearts")).toBeGreaterThan(
        strength(c(order[i + 1]!, "clubs"), "hearts"),
      );
    }
  });

  it("scores a trump suit deck at 152 raw points", () => {
    const total = (contract: Contract) =>
      fullDeck().reduce((sum, card) => sum + points(card, contract), 0);
    expect(total("hearts")).toBe(152);
  });

  it("scores no-trumps at 120 and all-trumps at 248 raw points", () => {
    const total = (contract: Contract) =>
      fullDeck().reduce((sum, card) => sum + points(card, contract), 0);
    expect(total("no-trumps")).toBe(120);
    expect(total("all-trumps")).toBe(248);
  });
});
