import { describe, expect, it } from "vitest";
import { applyBid, legalBids, startBidding, type BidAction, type BiddingState } from "./bidding";

/** Apply a list of [seat, action] pairs, failing the test on an illegal one. */
function run(state: BiddingState, moves: [number, BidAction][]): BiddingState {
  for (const [seat, action] of moves) {
    const r = applyBid(state, seat, action);
    if (!r.ok) throw new Error(`${seat} ${JSON.stringify(action)}: ${r.error}`);
    state = r.state;
  }
  return state;
}

const pass: BidAction = { type: "pass" };
const bid = (contract: Extract<BidAction, { type: "bid" }>["contract"]): BidAction => ({ type: "bid", contract });

describe("bidding", () => {
  it("starts with the player after the dealer", () => {
    expect(startBidding(3).turn).toBe(0);
  });

  it("four passes mean a redeal", () => {
    const s = run(startBidding(0), [[1, pass], [2, pass], [3, pass], [0, pass]]);
    expect(s.result).toBe("redeal");
  });

  it("three passes after a bid end the bidding", () => {
    const s = run(startBidding(0), [[1, bid("hearts")], [2, pass], [3, pass], [0, pass]]);
    expect(s.result).toEqual({ bidder: 1, contract: "hearts", multiplier: 1 });
  });

  it("the first bidder may be followed by passes then a later bid", () => {
    const s = run(startBidding(0), [[1, pass], [2, pass], [3, bid("clubs")], [0, pass], [1, pass], [2, pass]]);
    expect(s.result).toEqual({ bidder: 3, contract: "clubs", multiplier: 1 });
  });

  it("only allows higher bids", () => {
    const s = run(startBidding(0), [[1, bid("spades")]]);
    const bids = legalBids(s).filter((a) => a.type === "bid");
    expect(bids).toEqual([bid("no-trumps"), bid("all-trumps")]);
    expect(applyBid(s, 2, bid("hearts")).ok).toBe(false);
  });

  it("rejects actions out of turn", () => {
    expect(applyBid(startBidding(0), 3, pass).ok).toBe(false);
  });

  it("contra is only for the opposing team", () => {
    // seat 1 bids; seats 1 and 3 are one team, 0 and 2 the other
    const s = run(startBidding(0), [[1, bid("hearts")]]);
    expect(legalBids(s).some((a) => a.type === "contra")).toBe(true); // seat 2 is an opponent
    const s2 = run(s, [[2, pass]]);
    expect(legalBids(s2).some((a) => a.type === "contra")).toBe(false); // seat 3 is the bidder's partner
  });

  it("contra then three passes ends with multiplier 2", () => {
    const s = run(startBidding(0), [[1, bid("hearts")], [2, { type: "contra" }], [3, pass], [0, pass], [1, pass]]);
    expect(s.result).toEqual({ bidder: 1, contract: "hearts", multiplier: 2 });
  });

  it("no new bids after a contra", () => {
    const s = run(startBidding(0), [[1, bid("hearts")], [2, { type: "contra" }]]);
    expect(legalBids(s).some((a) => a.type === "bid")).toBe(false);
  });

  it("re-contra is only for the bidder's team and ends bidding at once", () => {
    let s = run(startBidding(0), [[1, bid("hearts")], [2, { type: "contra" }], [3, pass], [0, pass]]);
    expect(legalBids(s).some((a) => a.type === "recontra")).toBe(true); // seat 1 is the bidder
    s = run(s, [[1, { type: "recontra" }]]);
    expect(s.result).toEqual({ bidder: 1, contract: "hearts", multiplier: 4 });
  });

  it("re-contra is offered to the bidder's partner too, never to opponents", () => {
    let s = run(startBidding(0), [[1, bid("hearts")], [2, pass], [3, pass], [0, { type: "contra" }]]);
    expect(legalBids(s).some((a) => a.type === "recontra")).toBe(true); // seat 1, the bidder
    s = run(s, [[1, pass]]);
    expect(legalBids(s).some((a) => a.type === "recontra")).toBe(false); // seat 2, an opponent
    s = run(s, [[2, pass]]);
    expect(legalBids(s).some((a) => a.type === "recontra")).toBe(true); // seat 3, the bidder's partner
  });

  it("no actions are legal once bidding is over", () => {
    const s = run(startBidding(0), [[1, pass], [2, pass], [3, pass], [0, pass]]);
    expect(legalBids(s)).toEqual([]);
    expect(applyBid(s, 1, pass).ok).toBe(false);
  });
});
