import { cardEquals, points, type Card, type Contract } from "./cards";
import { resolveAnnouncements, type AnnouncementResult } from "./announcements";
import {
  applyBid,
  legalBids,
  startBidding,
  teamOf,
  type BidAction,
  type BiddingState,
  type BidOutcome,
} from "./bidding";
import { dealFirst, dealRest, nextSeat, shuffledDeck } from "./deal";
import { gameWinner, scoreRound, type RoundResult, type Team } from "./scoring";
import { legalPlays, trickWinner, type Play } from "./tricks";

export const LAST_TRICK_BONUS = 10;
export const TRICKS_PER_ROUND = 8;

export type Phase = "bidding" | "playing" | "roundEnd" | "gameOver";

export type GameAction =
  | { type: "bid"; bid: BidAction }
  | { type: "play"; card: Card }
  | { type: "nextRound" };

export type GameEvent =
  | { type: "dealt"; round: number; dealer: number }
  | { type: "bid"; seat: number; bid: BidAction }
  | { type: "redeal" }
  | { type: "contract"; outcome: BidOutcome }
  | { type: "played"; seat: number; card: Card }
  | { type: "trickWon"; winner: number; plays: Play[] }
  | { type: "announcements"; result: AnnouncementResult }
  | { type: "roundScored"; result: RoundResult; summary: RoundSummary }
  | { type: "gameOver"; winner: Team };

export interface RoundSummary {
  round: number;
  contract: Contract;
  bidder: number;
  multiplier: 1 | 2 | 4;
  cardPoints: [number, number];
  announcements: [number, number];
  capo: Team | null;
  result: RoundResult;
}

export interface GameState {
  /** Base seed; deal number n shuffles with `seed + n`. */
  seed: number;
  /** How many deals have happened, including redeals. */
  dealIndex: number;
  phase: Phase;
  round: number;
  dealer: number;
  /** Seat that must act next (bidding or playing); -1 outside those phases. */
  turn: number;
  hands: Card[][];
  /** Cards still to be dealt after bidding. */
  talon: Card[];
  bidding: BiddingState;
  contract: BidOutcome | null;
  trick: Play[];
  tricksPlayed: number;
  tricksWon: [number, number];
  /** Card points collected this round, per team. */
  cardPoints: [number, number];
  announcements: AnnouncementResult | null;
  /** True once the first trick is complete and announcements are shown to everyone. */
  announcementsRevealed: boolean;
  lastTrick: Play[] | null;
  /** Total score per team. */
  scores: [number, number];
  /** Recorded points hanging from tied rounds. */
  hanging: number;
  history: RoundSummary[];
  winner: Team | null;
}

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string };

function deal(seed: number, dealIndex: number, dealer: number): Pick<GameState, "hands" | "talon" | "bidding" | "turn"> {
  const { hands, rest } = dealFirst(shuffledDeck(seed + dealIndex), dealer);
  const bidding = startBidding(dealer);
  return { hands, talon: rest, bidding, turn: bidding.turn };
}

export function newGame(seed: number, dealer = 0): GameState {
  return {
    seed,
    dealIndex: 1,
    phase: "bidding",
    round: 1,
    dealer,
    ...deal(seed, 1, dealer),
    contract: null,
    trick: [],
    tricksPlayed: 0,
    tricksWon: [0, 0],
    cardPoints: [0, 0],
    announcements: null,
    announcementsRevealed: false,
    lastTrick: null,
    scores: [0, 0],
    hanging: 0,
    history: [],
    winner: null,
  };
}

/** Every action the given seat may take right now. */
export function legalActions(state: GameState, seat: number): GameAction[] {
  if (state.phase === "bidding") {
    if (seat !== state.turn) return [];
    return legalBids(state.bidding).map((bid) => ({ type: "bid", bid }));
  }
  if (state.phase === "playing") {
    if (seat !== state.turn || !state.contract) return [];
    return legalPlays(state.hands[seat]!, state.trick, state.contract.contract, seat).map((card) => ({
      type: "play",
      card,
    }));
  }
  if (state.phase === "roundEnd") return [{ type: "nextRound" }];
  return [];
}

export function applyAction(prev: GameState, seat: number, action: GameAction): ActionResult {
  if (seat < 0 || seat > 3) return { ok: false, error: "bad seat" };
  const state = structuredClone(prev);
  const events: GameEvent[] = [];

  switch (action.type) {
    case "bid":
      return applyBidAction(state, seat, action.bid, events);
    case "play":
      return applyPlay(state, seat, action.card, events);
    case "nextRound":
      return applyNextRound(state, events);
  }
}

function applyBidAction(state: GameState, seat: number, bid: BidAction, events: GameEvent[]): ActionResult {
  if (state.phase !== "bidding") return { ok: false, error: "not in bidding" };
  const r = applyBid(state.bidding, seat, bid);
  if (!r.ok) return r;
  state.bidding = r.state;
  state.turn = r.state.turn;
  events.push({ type: "bid", seat, bid });

  const result = r.state.result;
  if (result === "redeal") {
    events.push({ type: "redeal" });
    startRound(state, state.round, nextSeat(state.dealer), events);
    return { ok: true, state, events };
  }
  if (result) {
    state.contract = result;
    state.hands = dealRest(state.hands, state.talon, state.dealer);
    state.talon = [];
    state.phase = "playing";
    state.turn = nextSeat(state.dealer);
    state.announcements = resolveAnnouncements(state.hands, result.contract);
    events.push({ type: "contract", outcome: result });
  }
  return { ok: true, state, events };
}

function startRound(state: GameState, round: number, dealer: number, events: GameEvent[]): void {
  state.round = round;
  state.dealer = dealer;
  state.dealIndex += 1;
  Object.assign(state, deal(state.seed, state.dealIndex, dealer));
  state.phase = "bidding";
  state.contract = null;
  state.trick = [];
  state.tricksPlayed = 0;
  state.tricksWon = [0, 0];
  state.cardPoints = [0, 0];
  state.announcements = null;
  state.announcementsRevealed = false;
  state.lastTrick = null;
  events.push({ type: "dealt", round, dealer });
}

function applyPlay(state: GameState, seat: number, card: Card, events: GameEvent[]): ActionResult {
  if (state.phase !== "playing" || !state.contract) return { ok: false, error: "not in play" };
  if (seat !== state.turn) return { ok: false, error: "not your turn" };

  const hand = state.hands[seat]!;
  const contract = state.contract.contract;
  if (!hand.some((c) => cardEquals(c, card))) return { ok: false, error: "card not in hand" };
  if (!legalPlays(hand, state.trick, contract, seat).some((c) => cardEquals(c, card))) {
    return { ok: false, error: "illegal card" };
  }

  state.hands[seat] = hand.filter((c) => !cardEquals(c, card));
  state.trick.push({ seat, card });
  events.push({ type: "played", seat, card });

  if (state.trick.length < 4) {
    state.turn = nextSeat(seat);
    return { ok: true, state, events };
  }

  // Trick complete.
  const plays = state.trick;
  const winner = trickWinner(plays, contract);
  const team = teamOf(winner);
  state.tricksPlayed += 1;
  state.tricksWon[team] += 1;
  state.cardPoints[team] += plays.reduce((sum, p) => sum + points(p.card, contract), 0);
  state.lastTrick = plays;
  state.trick = [];
  state.turn = winner;
  events.push({ type: "trickWon", winner, plays });

  if (state.tricksPlayed === 1 && state.announcements) {
    state.announcementsRevealed = true;
    events.push({ type: "announcements", result: state.announcements });
  }

  if (state.tricksPlayed === TRICKS_PER_ROUND) {
    state.cardPoints[team] += LAST_TRICK_BONUS;
    finishRound(state, events);
  }
  return { ok: true, state, events };
}

function finishRound(state: GameState, events: GameEvent[]): void {
  const contract = state.contract!;
  const announcements = state.announcements!.points;
  const capo: Team | null = state.tricksWon[0] === TRICKS_PER_ROUND ? 0 : state.tricksWon[1] === TRICKS_PER_ROUND ? 1 : null;

  const result = scoreRound({
    contract: contract.contract,
    bidder: teamOf(contract.bidder),
    multiplier: contract.multiplier,
    cardPoints: state.cardPoints,
    announcements,
    capo,
    hanging: state.hanging,
  });

  state.scores = [state.scores[0] + result.recorded[0], state.scores[1] + result.recorded[1]];
  state.hanging = result.hanging;
  state.turn = -1;

  const summary: RoundSummary = {
    round: state.round,
    contract: contract.contract,
    bidder: contract.bidder,
    multiplier: contract.multiplier,
    cardPoints: [state.cardPoints[0], state.cardPoints[1]],
    announcements: [announcements[0], announcements[1]],
    capo,
    result,
  };
  state.history.push(summary);
  events.push({ type: "roundScored", result, summary });

  const winner = gameWinner(state.scores);
  if (winner !== null) {
    state.winner = winner;
    state.phase = "gameOver";
    events.push({ type: "gameOver", winner });
  } else {
    state.phase = "roundEnd";
  }
}

function applyNextRound(state: GameState, events: GameEvent[]): ActionResult {
  if (state.phase !== "roundEnd") return { ok: false, error: "round is not finished" };
  startRound(state, state.round + 1, nextSeat(state.dealer), events);
  return { ok: true, state, events };
}
