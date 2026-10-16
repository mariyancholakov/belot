import { teamOf, type BidAction } from "./bidding";
import { mulberry32 } from "./deal";
import type { GameAction } from "./game";
import { handValue, positionOf } from "./handModel";
import {
  announcementPoints,
  cardIndex,
  contractId,
  greedyPolicy,
  maskOf,
  playOut,
  roundResult,
  startRound,
  type SimPolicy,
  type SimRound,
} from "./sim";
import type { Multiplier } from "./scoring";
import type { GameView } from "./view";

/**
 * Bidding by simulation. The bot deals the cards it cannot see many times, weighs each deal by
 * how well it explains the bids made so far, plays every contract it could end up in to the end,
 * and takes the action whose contract is worth most to its team on average.
 */

export interface BidTuning {
  samples: number;
  /** Extra points a new bid must be worth over passing (bids carry the risk of a contra). */
  bidMargin: number;
  /** Extra points a contra must be worth over passing. */
  contraMargin: number;
  /** How much the other players' bids shape the deals (0 ignores them). */
  inference: number;
  /** The hand value at which another player is taken to be as likely to bid as not. */
  bidPoint: number;
  contraPoint: number;
  /** Spread of the bid-or-not curve, in points. */
  spread: number;
  /** How the simulated rounds are played. */
  policy: SimPolicy;
}

export const DEFAULT_BID_TUNING: BidTuning = {
  samples: 300,
  bidMargin: 2,
  contraMargin: 6,
  inference: 1,
  bidPoint: 0,
  contraPoint: 4,
  spread: 4,
  policy: greedyPolicy,
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

interface Auction {
  highest: { seat: number; contract: number } | null;
  multiplier: Multiplier;
}

/** Replays the bid log, calling `visit` with the state each bid was made in. */
function replay(log: GameView["bidLog"], visit: (seat: number, bid: BidAction, before: Auction) => void): Auction {
  const auction: Auction = { highest: null, multiplier: 1 };
  for (const { seat, bid } of log) {
    visit(seat, bid, { highest: auction.highest && { ...auction.highest }, multiplier: auction.multiplier });
    if (bid.type === "bid") {
      auction.highest = { seat, contract: contractId(bid.contract) };
      auction.multiplier = 1;
    } else if (bid.type === "contra") auction.multiplier = 2;
    else if (bid.type === "recontra") auction.multiplier = 4;
  }
  return auction;
}

/** How likely a seat holding `hand` (its first five cards) was to make the bids it made. */
function likelihood(view: GameView, seat: number, hand: number, t: BidTuning): number {
  const p = positionOf(seat, view.dealer);
  let l = 1;
  replay(view.bidLog, (s, bid, before) => {
    if (s !== seat) return;
    const odds = (value: number, point: number) => sigmoid((value - point) / t.spread);
    if (bid.type === "bid") {
      l *= odds(handValue(hand, contractId(bid.contract), p), t.bidPoint);
    } else if (bid.type === "contra" || bid.type === "recontra") {
      l *= odds(handValue(hand, before.highest!.contract, p), t.contraPoint);
    } else if (before.multiplier === 1 && !(before.highest && teamOf(before.highest.seat) === teamOf(seat))) {
      // A pass with bids still open says the hand had no contract worth bidding.
      let best = -Infinity;
      for (let c = before.highest ? before.highest.contract + 1 : 0; c < 6; c++) best = Math.max(best, handValue(hand, c, p));
      if (best > -Infinity) l *= 1 - odds(best, t.bidPoint);
    }
  });
  return l;
}

interface Option {
  action: GameAction;
  contract: number;
  multiplier: Multiplier;
  /** Seat whose team plays the contract. */
  bidder: number;
  margin: number;
}

/** The value of each bidding option for this seat's team, in recorded points per deal. */
export function bidOptions(view: GameView, seed: number, t: BidTuning = DEFAULT_BID_TUNING): (Option & { value: number })[] {
  const me = view.seat;
  const myTeam = teamOf(me);
  const auction = replay(view.bidLog, () => {});
  const options: Option[] = [];
  for (const action of view.legalActions) {
    if (action.type !== "bid") continue;
    const bid = action.bid;
    const h = auction.highest;
    if (bid.type === "bid") options.push({ action, contract: contractId(bid.contract), multiplier: 1, bidder: me, margin: t.bidMargin });
    else if (bid.type === "contra") options.push({ action, contract: h!.contract, multiplier: 2, bidder: h!.seat, margin: t.contraMargin });
    else if (bid.type === "recontra") options.push({ action, contract: h!.contract, multiplier: 4, bidder: h!.seat, margin: 0 });
    else if (h) options.push({ action, contract: h.contract, multiplier: auction.multiplier, bidder: h.seat, margin: 0 });
  }

  const contracts = [...new Set(options.map((o) => o.contract))];
  const totals = options.map(() => 0);
  let weightSum = 0;

  const mine = maskOf(view.hand);
  const lucky = view.lucky && view.lucky.seat !== me ? view.lucky : null;
  const luckyCard = lucky ? cardIndex(lucky.card) : -1;
  const unknown: number[] = [];
  for (let i = 0; i < 32; i++) if (!(mine & (1 << i)) && i !== luckyCard) unknown.push(i);
  const rand = mulberry32(seed);

  for (let n = 0; n < t.samples; n++) {
    for (let i = unknown.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [unknown[i], unknown[j]] = [unknown[j]!, unknown[i]!];
    }
    // First five cards of every other seat, then three more for everybody.
    const first = [0, 0, 0, 0];
    first[me] = mine;
    let k = 0;
    for (let s = 0; s < 4; s++) {
      if (s === me) continue;
      let need = 5;
      if (lucky && lucky.seat === s) {
        first[s]! |= 1 << luckyCard;
        need--;
      }
      while (need-- > 0) first[s]! |= 1 << unknown[k++]!;
    }
    const hands = first.map((h) => h);
    for (let s = 0; s < 4; s++) for (let i = 0; i < 3; i++) hands[s]! |= 1 << unknown[k++]!;

    let w = 1;
    if (t.inference > 0) {
      for (let s = 0; s < 4; s++) if (s !== me) w *= likelihood(view, s, first[s]!, t);
      w = Math.pow(w, t.inference);
    }
    if (w < 1e-9) continue;
    weightSum += w;

    const bonus = announcementPoints(hands);
    for (const c of contracts) {
      const r: SimRound = playOut(startRound(hands, c, me, view.dealer, 1, [bonus[0], bonus[1]]), t.policy);
      options.forEach((o, i) => {
        if (o.contract !== c) return;
        r.bidder = o.bidder;
        r.multiplier = o.multiplier;
        const rec = roundResult(r).recorded;
        totals[i]! += w * (rec[myTeam]! - rec[1 - myTeam]!);
      });
    }
  }

  return options.map((o, i) => ({ ...o, value: weightSum > 0 ? totals[i]! / weightSum : 0 }));
}

/** The bid with the best value after its margin; passing with no bid yet on the table is worth 0. */
export function chooseBid(view: GameView, seed: number, t: BidTuning = DEFAULT_BID_TUNING): GameAction {
  const options = bidOptions(view, seed, t);
  const pass = view.legalActions.find((a) => a.type === "bid" && a.bid.type === "pass")!;
  let best: GameAction = pass;
  let bestScore = options.find((o) => o.action === pass)?.value ?? 0;
  for (const o of options) {
    if (o.action === pass) continue;
    const score = o.value - o.margin;
    if (score > bestScore) {
      best = o.action;
      bestScore = score;
    }
  }
  return best;
}
