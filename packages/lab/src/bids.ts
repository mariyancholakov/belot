import { applyAction, bidActionIndex, bidContextOf, maskOf, mulberry32, newGame, viewFor } from "@belot/engine";
import { parseBot } from "./bots";

/** Seeds whose auctions a worker records, with the bot that bids. */
export interface BidJob {
  bot: string;
  from: number;
  to: number;
}

/** Up to this many state inputs per bid (see `bidStateInputs`); unused slots hold 255. */
export const STATE_SLOTS = 6;

/** Every bid of the recorded auctions: the five cards, the state inputs, the legal actions and the action taken. */
export interface BidRecords {
  hands: Int32Array;
  states: Uint8Array;
  legal: Uint16Array;
  actions: Uint8Array;
}

/** Plays the auction of the first deal of each seed with `bot` in every seat (redeals included) and records each bid. */
export function recordBids(job: BidJob): BidRecords {
  const bot = parseBot(job.bot);
  const hands: number[] = [];
  const states: number[] = [];
  const legal: number[] = [];
  const actions: number[] = [];
  for (let seed = job.from; seed < job.to; seed++) {
    let state = newGame(seed, seed % 4);
    for (let step = 0; state.phase !== "playing"; step++) {
      const seat = state.turn;
      let action;
      if (state.phase === "cutting") action = { type: "cut" as const, position: 1 + Math.floor(mulberry32(seed * 1009 + state.dealIndex)() * 31) };
      else if (state.phase === "dealing") action = { type: "deal" as const, lucky: false };
      else if (state.phase === "shuffling") action = { type: "shuffle" as const };
      else {
        const view = viewFor(state, seat);
        action = bot(view, (Math.imul(seed, 0x9e3779b1) + step) | 0)!;
        if (action.type !== "bid") throw new Error(`expected a bid, got ${action.type}`);
        const context = bidContextOf(view);
        hands.push(maskOf(view.hand));
        for (let k = 0; k < STATE_SLOTS; k++) states.push(context.state[k] ?? 255);
        legal.push(context.legal);
        actions.push(bidActionIndex(action.bid));
      }
      const r = applyAction(state, seat, action);
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
  }
  return { hands: Int32Array.from(hands), states: Uint8Array.from(states), legal: Uint16Array.from(legal), actions: Uint8Array.from(actions) };
}
