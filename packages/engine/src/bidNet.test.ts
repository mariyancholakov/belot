import { describe, expect, it } from "vitest";
import { BID_ACTIONS, BID_INPUTS, bidIndex, bidLogits, bidProbability, bidStateInputs, CONTRA, likeliestBid, PASS, stateHidden, type BidNetWeights } from "./bidNet";

/** A network with one hidden unit that copies input `from` into output `to`. */
function wire(from: number, to: number): BidNetWeights {
  const w1 = new Array(BID_INPUTS).fill(0);
  w1[from] = 1;
  const w2 = new Array(BID_ACTIONS).fill(0);
  w2[to] = 3;
  return { hidden: 1, w1, b1: [0], w2, b2: new Array(BID_ACTIONS).fill(0) };
}

describe("bid network", () => {
  it("lays the auction out in fixed input slots", () => {
    // Position 2, hearts (2) highest, held by an opponent, doubled, partner bid clubs, opponents hearts.
    expect(bidStateInputs(2, 2, 2, 2, 0, 2)).toEqual([34, 39, 45, 46, 48, 57]);
    // Nobody has bid yet.
    expect(bidStateInputs(0, -1, -1, 1, -1, -1)).toEqual([32, 36, 47, 54]);
  });

  it("scores only the legal actions and sums to one over them", () => {
    // The J of spades (card 28) pushes towards a spades bid.
    const net = wire(28, bidIndex(3));
    const legal = (1 << PASS) | (1 << bidIndex(3)) | (1 << CONTRA);
    const base = stateHidden(net, bidStateInputs(0, -1, -1, 1, -1, -1));
    const logits = bidLogits(net, base, 1 << 28, legal);
    expect(logits[bidIndex(0)]).toBe(-Infinity);
    expect(likeliestBid(logits)).toBe(bidIndex(3));
    const total = [PASS, bidIndex(3), CONTRA].reduce((s, k) => s + bidProbability(logits, k), 0);
    expect(total).toBeCloseTo(1, 10);
    // Without the J nothing stands out.
    expect(bidProbability(bidLogits(net, base, 1 << 27, legal), PASS)).toBeCloseTo(1 / 3, 10);
  });
});
