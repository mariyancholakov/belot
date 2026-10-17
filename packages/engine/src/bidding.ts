import type { Contract } from "./cards";
import { nextSeat } from "./deal";
import type { Multiplier, Team } from "./scoring";

/** Weakest to strongest. */
export const BID_ORDER: readonly Contract[] = [
  "clubs",
  "diamonds",
  "hearts",
  "spades",
  "no-trumps",
  "all-trumps",
];

export type BidAction =
  | { type: "pass" }
  | { type: "bid"; contract: Contract }
  | { type: "contra" }
  | { type: "recontra" };

export interface BidOutcome {
  /** Seat that made the winning bid. */
  bidder: number;
  contract: Contract;
  multiplier: Multiplier;
}

export interface BiddingState {
  dealer: number;
  /** Seat that must act next. */
  turn: number;
  highest: { seat: number; contract: Contract } | null;
  multiplier: Multiplier;
  /** Consecutive passes since the last bid, contra or re-contra. */
  passes: number;
  /** Set when bidding is over: the final contract, or "redeal" if everyone passed. */
  result: BidOutcome | "redeal" | null;
}

export type BidResult =
  | { ok: true; state: BiddingState }
  | { ok: false; error: string };

export const teamOf = (seat: number): Team => (seat % 2) as Team;

/** Bidding starts with the player after the dealer. */
export function startBidding(dealer: number): BiddingState {
  return { dealer, turn: nextSeat(dealer), highest: null, multiplier: 1, passes: 0, result: null };
}

export function bidRank(contract: Contract): number {
  return BID_ORDER.indexOf(contract);
}

/** Every action the player on turn may take. */
export function legalBids(state: BiddingState): BidAction[] {
  if (state.result !== null) return [];
  const actions: BidAction[] = [{ type: "pass" }];
  const { highest, multiplier, turn } = state;

  // A higher bid is allowed after a contra too; it clears the contra.
  if (multiplier < 4) {
    const floor = highest ? bidRank(highest.contract) : -1;
    for (const contract of BID_ORDER) {
      if (bidRank(contract) > floor) actions.push({ type: "bid", contract });
    }
  }
  if (highest && multiplier === 1 && teamOf(turn) !== teamOf(highest.seat)) {
    actions.push({ type: "contra" });
  }
  if (highest && multiplier === 2 && teamOf(turn) === teamOf(highest.seat)) {
    actions.push({ type: "recontra" });
  }
  return actions;
}

export function applyBid(state: BiddingState, seat: number, action: BidAction): BidResult {
  if (state.result !== null) return { ok: false, error: "bidding is over" };
  if (seat !== state.turn) return { ok: false, error: "not your turn" };

  const legal = legalBids(state).some(
    (a) =>
      a.type === action.type &&
      (a.type !== "bid" || (action.type === "bid" && a.contract === action.contract)),
  );
  if (!legal) return { ok: false, error: "illegal bid" };

  const next: BiddingState = { ...state, turn: nextSeat(seat) };

  switch (action.type) {
    case "bid":
      next.highest = { seat, contract: action.contract };
      next.multiplier = 1;
      next.passes = 0;
      break;
    case "contra":
      next.multiplier = 2;
      next.passes = 0;
      break;
    case "recontra":
      next.multiplier = 4;
      next.passes = 0;
      next.result = outcome(next);
      return { ok: true, state: next };
    case "pass":
      next.passes = state.passes + 1;
      break;
  }

  if (next.highest === null && next.passes === 4) next.result = "redeal";
  else if (next.highest !== null && next.passes === 3) next.result = outcome(next);

  return { ok: true, state: next };
}

function outcome(state: BiddingState): BidOutcome {
  const { highest, multiplier } = state;
  if (!highest) throw new Error("no bid to resolve");
  return { bidder: highest.seat, contract: highest.contract, multiplier };
}
