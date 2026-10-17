import type { BidNetWeights } from "./bidNet";

/** Placeholder until `pnpm --filter @belot/lab fit-bids` writes the trained weights. */
export const BID_NET: BidNetWeights = { hidden: 1, w1: new Array(61).fill(0), b1: [0], w2: new Array(9).fill(0), b2: new Array(9).fill(0) };
