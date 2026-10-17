import { teamOf, type BidAction } from "./bidding";
import type { Contract } from "./cards";
import { mulberry32 } from "./deal";
import { smartPolicy } from "./rollout";
import type { GameAction } from "./game";
import { handValue, positionOf } from "./handModel";
import {
  announcementPoints,
  cardIndex,
  contractId,
  maskOf,
  playOut,
  roundResult,
  startRound,
  type SimPolicy,
  type SimRound,
} from "./sim";
import { TARGET_SCORE, type Multiplier } from "./scoring";
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
  /** Extra hand value another player wants before overcalling a partner, or re-contra. */
  overcallExtra: number;
  recontraExtra: number;
  /** 1: contra with nothing to lose when the opponents' contract would end the game (`lastChanceContra`). */
  lastChance: number;
  /** 1: play the rest of the auction out with the hand model; 0: take every bid to stand as it is. */
  lookahead: number;
  /** How the simulated rounds are played. */
  policy: SimPolicy;
}

export const DEFAULT_BID_TUNING: BidTuning = {
  samples: 300,
  bidMargin: 2,
  contraMargin: 6,
  inference: 1,
  bidPoint: 3,
  contraPoint: 4,
  spread: 4,
  overcallExtra: 6,
  recontraExtra: 4,
  lastChance: 1,
  lookahead: 1,
  policy: smartPolicy,
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

interface Auction {
  highest: { seat: number; contract: number } | null;
  multiplier: Multiplier;
  /** Passes since the last bid, contra or re-contra. */
  passes: number;
  /** True once a re-contra has ended the bidding. */
  closed: boolean;
}

/** The auction after `seat` makes `bid`. */
function after(a: Auction, seat: number, bid: BidAction | { type: "bid"; contract: number }): Auction {
  if (bid.type === "bid") return { highest: { seat, contract: typeof bid.contract === "number" ? bid.contract : contractId(bid.contract) }, multiplier: 1, passes: 0, closed: false };
  if (bid.type === "contra") return { ...a, multiplier: 2, passes: 0 };
  if (bid.type === "recontra") return { ...a, multiplier: 4, passes: 0, closed: true };
  return { ...a, passes: a.passes + 1 };
}

const over = (a: Auction) => a.closed || (a.highest === null ? a.passes === 4 : a.passes === 3);

/** Replays the bid log, calling `visit` with the state each bid was made in. */
function replay(log: GameView["bidLog"], visit: (seat: number, bid: BidAction, before: Auction) => void): Auction {
  let auction: Auction = { highest: null, multiplier: 1, passes: 0, closed: false };
  for (const { seat, bid } of log) {
    visit(seat, bid, auction);
    auction = after(auction, seat, bid);
  }
  return auction;
}

type ModelBid = { type: "pass" } | { type: "bid"; contract: number } | { type: "contra" } | { type: "recontra" };

/** What another player with `hand` (five cards) is taken to bid: the quick hand model against fixed points. */
function modelBid(hand: number, seat: number, a: Auction, dealer: number, t: BidTuning): ModelBid {
  const p = positionOf(seat, dealer);
  const h = a.highest;
  if (a.multiplier === 4) return { type: "pass" };
  const partnerHolds = h !== null && teamOf(h.seat) === teamOf(seat);
  let choice: ModelBid = { type: "pass" };
  let best = 0;
  if (h && a.multiplier === 2) {
    const v = handValue(hand, h.contract, p) - t.contraPoint - t.recontraExtra;
    if (partnerHolds && v > best) {
      best = v;
      choice = { type: "recontra" };
    }
  } else if (h && !partnerHolds) {
    const v = handValue(hand, h.contract, p) - t.contraPoint;
    if (v > best) {
      best = v;
      choice = { type: "contra" };
    }
  }
  const point = t.bidPoint + (partnerHolds ? t.overcallExtra : 0);
  for (let c = h ? h.contract + 1 : 0; c < 6; c++) {
    const v = handValue(hand, c, p) - point;
    if (v > best) {
      best = v;
      choice = { type: "bid", contract: c };
    }
  }
  return choice;
}

/** Plays the auction to its end from `a` with the model for every other seat; this seat passes from now on. */
function finish(a: Auction, next: number, me: number, first: readonly number[], dealer: number, t: BidTuning): Auction {
  let seat = next;
  while (!over(a)) {
    a = after(a, seat, seat === me ? { type: "pass" } : modelBid(first[seat]!, seat, a, dealer, t));
    seat = (seat + 1) % 4;
  }
  return a;
}

/** Recorded points the bidders usually take from a made contract, by contract number. */
const USUAL_MADE = [12, 12, 12, 12, 16, 16];

/**
 * Nothing to lose: the opponents' contract, if made, would most likely take them to 151 while
 * `team` is behind, so a contra can only help (it doubles what `team` takes if they fail).
 */
export function lastChanceContra(scores: readonly [number, number], team: number, contract: number): boolean {
  const them = scores[1 - team]!;
  return scores[team]! < them && them + USUAL_MADE[contract]! >= TARGET_SCORE;
}

/** What each of a seat's bids says about its first five cards, read once from the bid log. */
type Evidence = { kind: "bid" | "contra" | "pass"; contract: number }[];

function evidenceOf(view: GameView, seat: number): Evidence {
  const out: Evidence = [];
  replay(view.bidLog, (s, bid, before) => {
    if (s !== seat) return;
    if (bid.type === "bid") out.push({ kind: "bid", contract: contractId(bid.contract) });
    else if (bid.type === "recontra") out.push({ kind: "contra", contract: before.highest!.contract });
    // A last-chance contra says nothing about the hand.
    else if (bid.type === "contra") {
      if (!lastChanceContra(view.scores, teamOf(seat), before.highest!.contract)) out.push({ kind: "contra", contract: before.highest!.contract });
    }
    // A pass with bids still open says the hand had no contract worth bidding.
    else if (before.multiplier === 1 && !(before.highest && teamOf(before.highest.seat) === teamOf(seat)) && (before.highest?.contract ?? -1) < 5) {
      out.push({ kind: "pass", contract: before.highest ? before.highest.contract + 1 : 0 });
    }
  });
  return out;
}

/**
 * For each seat, how likely a seat holding a given hand (its first five cards) was to make the bids
 * it made; null for a seat whose bids say nothing about its hand.
 */
export function bidLikelihoods(view: GameView, t: BidTuning = DEFAULT_BID_TUNING): (((hand: number) => number) | null)[] {
  return [0, 1, 2, 3].map((seat) => {
    const evidence = evidenceOf(view, seat);
    if (evidence.length === 0) return null;
    const p = positionOf(seat, view.dealer);
    const odds = (value: number, point: number) => sigmoid((value - point) / t.spread);
    return (hand: number) => {
      let l = 1;
      for (const e of evidence) {
        if (e.kind === "bid") l *= odds(handValue(hand, e.contract, p), t.bidPoint);
        else if (e.kind === "contra") l *= odds(handValue(hand, e.contract, p), t.contraPoint);
        else {
          let best = -Infinity;
          for (let c = e.contract; c < 6; c++) best = Math.max(best, handValue(hand, c, p));
          l *= 1 - odds(best, t.bidPoint);
        }
      }
      return l;
    };
  });
}

interface Option {
  action: GameAction;
  /** The auction right after this action. */
  auction: Auction;
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
    const next = after(auction, me, bid);
    if (bid.type === "bid") options.push({ action, auction: next, contract: contractId(bid.contract), multiplier: 1, bidder: me, margin: t.bidMargin });
    else if (bid.type === "contra") options.push({ action, auction: next, contract: h!.contract, multiplier: 2, bidder: h!.seat, margin: t.contraMargin });
    else if (bid.type === "recontra") options.push({ action, auction: next, contract: h!.contract, multiplier: 4, bidder: h!.seat, margin: 0 });
    else options.push({ action, auction: next, contract: h ? h.contract : -1, multiplier: auction.multiplier, bidder: h ? h.seat : me, margin: 0 });
  }

  const totals = options.map(() => 0);
  let weightSum = 0;

  const mine = maskOf(view.hand);
  const lucky = view.lucky && view.lucky.seat !== me ? view.lucky : null;
  const luckyCard = lucky ? cardIndex(lucky.card) : -1;
  const unknown: number[] = [];
  for (let i = 0; i < 32; i++) if (!(mine & (1 << i)) && i !== luckyCard) unknown.push(i);
  const rand = mulberry32(seed);

  const likely = bidLikelihoods(view, t);

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
      for (let s = 0; s < 4; s++) if (s !== me) w *= likely[s]?.(first[s]!) ?? 1;
      w = Math.pow(w, t.inference);
    }
    if (w < 1e-9) continue;
    weightSum += w;

    const played: (SimRound | undefined)[] = [];
    options.forEach((o, i) => {
      const end = t.lookahead > 0 ? finish(o.auction, (me + 1) % 4, me, first, view.dealer, t) : o.contract < 0 ? null : { highest: { seat: o.bidder, contract: o.contract }, multiplier: o.multiplier };
      if (!end?.highest) return; // everybody passed: a redeal is worth nothing to either side
      const c = end.highest.contract;
      const r = (played[c] ??= playOut(startRound(hands, c, me, view.dealer, 1, announcementPoints(hands, c)), t.policy));
      r.bidder = end.highest.seat;
      r.multiplier = end.multiplier;
      const rec = roundResult(r).recorded;
      totals[i]! += w * (rec[myTeam]! - rec[1 - myTeam]!);
    });
  }

  return options.map((o, i) => ({ ...o, value: weightSum > 0 ? totals[i]! / weightSum : 0 }));
}

/** The bid with the best value after its margin. */
export function chooseBid(view: GameView, seed: number, t: BidTuning = DEFAULT_BID_TUNING): GameAction {
  const options = bidOptions(view, seed, t);
  const pass = view.legalActions.find((a) => a.type === "bid" && a.bid.type === "pass")!;
  let best: GameAction = pass;
  let bestScore = options.find((o) => o.action === pass)!.value;
  const h = view.highestBid;
  const lastChance = t.lastChance > 0 && h !== null && lastChanceContra(view.scores, teamOf(view.seat), contractId(h.contract as Contract));
  for (const o of options) {
    if (o.action === pass) continue;
    let score = o.value - o.margin;
    // With nothing to lose, a contra is never worse than passing.
    if (lastChance && o.action.type === "bid" && o.action.bid.type === "contra") score = Math.max(score, bestScore + 0.01);
    if (score > bestScore) {
      best = o.action;
      bestScore = score;
    }
  }
  return best;
}
