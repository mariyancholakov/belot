import { cardEquals, points, type Card, type Contract, type Suit } from "./cards";
import {
  belotCallable,
  findAnnouncements,
  findBelots,
  holdsAllRemainingTricks,
  resolveDeclared,
  type Announcement,
  type AnnouncementKind,
  type AnnouncementResult,
} from "./announcements";
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

export type Phase = "shuffling" | "cutting" | "dealing" | "bidding" | "playing" | "roundEnd" | "gameOver";

export type GameAction =
  | { type: "bid"; bid: BidAction }
  /** `belot`: call the belot when this is the first card of a held K+Q of trump. */
  | { type: "play"; card: Card; belot?: boolean }
  /** Before a seat's first card: declare the announcements it holds, or keep them to itself. */
  | { type: "announce"; declare: boolean }
  /** Lay the cards down when every remaining trick is certain; the team takes them all. */
  | { type: "claim"; belot?: boolean }
  | { type: "nextRound" }
  /** The cutter lifts the top `position` cards (1-31) and puts them under the rest. */
  | { type: "cut"; position: number }
  /** Dealer shuffles the deck (only offered after three all-pass deals in a row). */
  | { type: "shuffle" }
  | { type: "skipShuffle" }
  /** Dealer deals; `lucky` turns the first card dealt face up for everybody ("късметче"). */
  | { type: "deal"; lucky: boolean };

export type GameEvent =
  | { type: "cut"; seat: number; position: number }
  | { type: "shuffled"; seat: number }
  | { type: "dealt"; round: number; dealer: number; lucky: LuckyCard | null }
  | { type: "bid"; seat: number; bid: BidAction }
  | { type: "redeal" }
  | { type: "contract"; outcome: BidOutcome }
  | { type: "belot"; seat: number; suit: Suit }
  | { type: "played"; seat: number; card: Card }
  | { type: "trickWon"; winner: number; plays: Play[] }
  | { type: "announced"; seat: number; kinds: AnnouncementKind[] }
  | { type: "claimed"; seat: number; cards: Card[] }
  | { type: "announcements"; result: AnnouncementResult }
  | { type: "roundScored"; result: RoundResult; summary: RoundSummary }
  | { type: "gameOver"; winner: Team };

/** The face-up first card of a "късметче" deal. */
export interface LuckyCard {
  seat: number;
  card: Card;
}

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
  /** The deck in its current order. Players shuffle only after three all-pass deals in a row. */
  deck: Card[];
  /** Cards played this round in play order; they become the next deck (no shuffle). */
  collected: Card[];
  /** Consecutive deals in which everybody passed. */
  allPassStreak: number;
  /** True when this deal starts from a freshly shuffled deck (game start, or the dealer shuffled). */
  fresh: boolean;
  lucky: LuckyCard | null;
  /** Cards still to be dealt after bidding. */
  talon: Card[];
  bidding: BiddingState;
  /** Every bid action of the current deal, in order. */
  bidLog: { seat: number; bid: BidAction }[];
  contract: BidOutcome | null;
  trick: Play[];
  tricksPlayed: number;
  tricksWon: [number, number];
  /** Card points collected this round, per team. */
  cardPoints: [number, number];
  /** What each seat declared before its first card, and whether it has decided yet. */
  declared: Announcement[][];
  decided: boolean[];
  /** Belots called so far, per seat. */
  belots: Suit[][];
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

/** The player to the dealer's left (the previous seat in play order) cuts the deck. */
export const cutterOf = (dealer: number): number => (dealer + 3) % 4;

/** After this many all-pass deals in a row the dealer may shuffle. */
export const SHUFFLE_AFTER_PASSES = 3;

export function newGame(seed: number, dealer = 0): GameState {
  return {
    seed,
    dealIndex: 1,
    phase: "cutting",
    round: 1,
    dealer,
    deck: shuffledDeck(seed + 1),
    collected: [],
    allPassStreak: 0,
    fresh: true,
    lucky: null,
    hands: [[], [], [], []],
    talon: [],
    bidding: startBidding(dealer),
    turn: cutterOf(dealer),
    bidLog: [],
    contract: null,
    trick: [],
    tricksPlayed: 0,
    tricksWon: [0, 0],
    cardPoints: [0, 0],
    declared: [[], [], [], []],
    decided: [false, false, false, false],
    belots: [[], [], [], []],
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
  if (state.phase === "shuffling") {
    if (seat !== state.turn) return [];
    return [{ type: "shuffle" }, { type: "skipShuffle" }];
  }
  if (state.phase === "dealing") {
    if (seat !== state.turn) return [];
    return [
      { type: "deal", lucky: false },
      { type: "deal", lucky: true },
    ];
  }
  if (state.phase === "cutting") {
    if (seat !== state.turn) return [];
    return Array.from({ length: 31 }, (_, i) => ({ type: "cut" as const, position: i + 1 }));
  }
  if (state.phase === "bidding") {
    if (seat !== state.turn) return [];
    return legalBids(state.bidding).map((bid) => ({ type: "bid", bid }));
  }
  if (state.phase === "playing") {
    if (seat !== state.turn || !state.contract) return [];
    if (mustDecideAnnouncements(state, seat)) return [{ type: "announce", declare: true }, { type: "announce", declare: false }];
    const plays = legalPlays(state.hands[seat]!, state.trick, state.contract.contract, seat).map((card) => ({
      type: "play" as const,
      card,
    }));
    return canClaim(state, seat) ? [...plays, { type: "claim" as const }] : plays;
  }
  if (state.phase === "roundEnd") return [{ type: "nextRound" }];
  return [];
}

/** The seat is about to play its first card and holds announcements it has not yet decided about. */
export function mustDecideAnnouncements(state: GameState, seat: number): boolean {
  return state.phase === "playing" && state.tricksPlayed === 0 && !state.decided[seat] && findAnnouncements(state.hands[seat]!).length > 0;
}

/** Whether `seat` may lay its cards down now: it leads, and every card it holds is certain to win. */
export function canClaim(state: GameState, seat: number): boolean {
  if (state.phase !== "playing" || !state.contract || state.turn !== seat || state.trick.length !== 0) return false;
  if (mustDecideAnnouncements(state, seat)) return false;
  const hand = state.hands[seat]!;
  return hand.length >= 2 && holdsAllRemainingTricks(hand, state.collected, state.contract.contract);
}

export function applyAction(prev: GameState, seat: number, action: GameAction): ActionResult {
  if (seat < 0 || seat > 3) return { ok: false, error: "bad seat" };
  const state = structuredClone(prev);
  const events: GameEvent[] = [];

  switch (action.type) {
    case "bid":
      return applyBidAction(state, seat, action.bid, events);
    case "play":
      return applyPlay(state, seat, action.card, action.belot === true, events);
    case "announce":
      return applyAnnounce(state, seat, action.declare, events);
    case "claim":
      return applyClaim(state, seat, action.belot === true, events);
    case "nextRound":
      return applyNextRound(state, events);
    case "cut":
      return applyCut(state, seat, action.position, events);
    case "shuffle":
    case "skipShuffle":
      return applyShuffleChoice(state, seat, action.type === "shuffle", events);
    case "deal":
      return applyDeal(state, seat, action.lucky, events);
  }
}

function applyBidAction(state: GameState, seat: number, bid: BidAction, events: GameEvent[]): ActionResult {
  if (state.phase !== "bidding") return { ok: false, error: "not in bidding" };
  const r = applyBid(state.bidding, seat, bid);
  if (!r.ok) return r;
  state.bidding = r.state;
  state.turn = r.state.turn;
  state.bidLog.push({ seat, bid });
  events.push({ type: "bid", seat, bid });

  const result = r.state.result;
  if (result === "redeal") {
    events.push({ type: "redeal" });
    startRound(state, state.round, nextSeat(state.dealer), state.deck, state.allPassStreak + 1);
    return { ok: true, state, events };
  }
  if (result) {
    state.contract = result;
    state.allPassStreak = 0;
    state.hands = dealRest(state.hands, state.talon, state.dealer);
    state.talon = [];
    state.phase = "playing";
    state.turn = nextSeat(state.dealer);
    events.push({ type: "contract", outcome: result });
  }
  return { ok: true, state, events };
}

/**
 * Set up the next deal. The deck is not reshuffled: after a redeal it is the same deck, after a
 * round it is the played cards in the order they were played. The dealer may shuffle only after
 * `SHUFFLE_AFTER_PASSES` all-pass deals in a row.
 */
function startRound(state: GameState, round: number, dealer: number, deck: Card[], allPassStreak: number): void {
  state.round = round;
  state.dealer = dealer;
  state.dealIndex += 1;
  state.deck = deck;
  state.collected = [];
  state.allPassStreak = allPassStreak;
  state.fresh = false;
  state.lucky = null;
  state.hands = [[], [], [], []];
  state.talon = [];
  state.bidding = startBidding(dealer);
  state.bidLog = [];
  state.contract = null;
  state.trick = [];
  state.tricksPlayed = 0;
  state.tricksWon = [0, 0];
  state.cardPoints = [0, 0];
  state.declared = [[], [], [], []];
  state.decided = [false, false, false, false];
  state.belots = [[], [], [], []];
  state.announcements = null;
  state.announcementsRevealed = false;
  state.lastTrick = null;
  if (allPassStreak >= SHUFFLE_AFTER_PASSES) {
    state.phase = "shuffling";
    state.turn = dealer;
  } else {
    state.phase = "cutting";
    state.turn = cutterOf(dealer);
  }
}

function applyShuffleChoice(state: GameState, seat: number, shuffle: boolean, events: GameEvent[]): ActionResult {
  if (state.phase !== "shuffling") return { ok: false, error: "not shuffling" };
  if (seat !== state.turn) return { ok: false, error: "only the dealer decides" };
  if (shuffle) {
    state.deck = shuffledDeck(state.seed + state.dealIndex);
    state.fresh = true;
    state.allPassStreak = 0;
    events.push({ type: "shuffled", seat });
  }
  state.phase = "cutting";
  state.turn = cutterOf(state.dealer);
  return { ok: true, state, events };
}

function applyCut(state: GameState, seat: number, position: number, events: GameEvent[]): ActionResult {
  if (state.phase !== "cutting") return { ok: false, error: "not cutting" };
  if (seat !== state.turn) return { ok: false, error: "not your cut" };
  if (!Number.isInteger(position) || position < 1 || position > 31) return { ok: false, error: "bad cut" };
  state.deck = [...state.deck.slice(position), ...state.deck.slice(0, position)];
  state.phase = "dealing";
  state.turn = state.dealer;
  events.push({ type: "cut", seat, position });
  return { ok: true, state, events };
}

function applyDeal(state: GameState, seat: number, lucky: boolean, events: GameEvent[]): ActionResult {
  if (state.phase !== "dealing") return { ok: false, error: "not dealing" };
  if (seat !== state.turn) return { ok: false, error: "only the dealer deals" };
  const { hands, rest } = dealFirst(state.deck, state.dealer);
  state.hands = hands;
  state.talon = rest;
  const first = nextSeat(state.dealer);
  state.lucky = lucky ? { seat: first, card: hands[first]![0]! } : null;
  state.phase = "bidding";
  state.turn = state.bidding.turn;
  events.push({ type: "dealt", round: state.round, dealer: state.dealer, lucky: state.lucky });
  return { ok: true, state, events };
}

function applyAnnounce(state: GameState, seat: number, declare: boolean, events: GameEvent[]): ActionResult {
  if (state.phase !== "playing" || !state.contract) return { ok: false, error: "not in play" };
  if (seat !== state.turn) return { ok: false, error: "not your turn" };
  if (!mustDecideAnnouncements(state, seat)) return { ok: false, error: "nothing to announce" };
  state.decided[seat] = true;
  if (declare) {
    state.declared[seat] = findAnnouncements(state.hands[seat]!);
    events.push({ type: "announced", seat, kinds: state.declared[seat]!.map((a) => a.kind) });
  }
  return { ok: true, state, events };
}

function applyPlay(state: GameState, seat: number, card: Card, belot: boolean, events: GameEvent[]): ActionResult {
  if (state.phase !== "playing" || !state.contract) return { ok: false, error: "not in play" };
  if (seat !== state.turn) return { ok: false, error: "not your turn" };
  if (mustDecideAnnouncements(state, seat)) return { ok: false, error: "decide about your announcements first" };

  const hand = state.hands[seat]!;
  const contract = state.contract.contract;
  if (!hand.some((c) => cardEquals(c, card))) return { ok: false, error: "card not in hand" };
  if (!legalPlays(hand, state.trick, contract, seat).some((c) => cardEquals(c, card))) {
    return { ok: false, error: "illegal card" };
  }

  state.hands[seat] = hand.filter((c) => !cardEquals(c, card));
  state.trick.push({ seat, card });
  state.collected.push(card);

  // Belot counts only when the player calls it as the first card of a held K+Q pair is played.
  if (belot && belotCallable(hand, card, contract) && !state.belots[seat]!.includes(card.suit)) {
    state.belots[seat]!.push(card.suit);
    events.push({ type: "belot", seat, suit: card.suit });
  }
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

  if (state.tricksPlayed === 1) revealAnnouncements(state, events);

  if (state.tricksPlayed === TRICKS_PER_ROUND) {
    state.cardPoints[team] += LAST_TRICK_BONUS;
    finishRound(state, events);
  }
  return { ok: true, state, events };
}

function revealAnnouncements(state: GameState, events: GameEvent[]): void {
  state.announcements = resolveDeclared(state.declared, state.belots);
  state.announcementsRevealed = true;
  events.push({ type: "announcements", result: state.announcements });
}

function applyClaim(state: GameState, seat: number, belot: boolean, events: GameEvent[]): ActionResult {
  if (!canClaim(state, seat)) return { ok: false, error: "cannot lay the cards down" };
  const contract = state.contract!.contract;
  const team = teamOf(seat);
  const laid = [...state.hands[seat]!];

  if (belot) {
    for (const suit of findBelots(laid, contract)) {
      if (state.belots[seat]!.includes(suit)) continue;
      state.belots[seat]!.push(suit);
      events.push({ type: "belot", seat, suit });
    }
  }
  events.push({ type: "claimed", seat, cards: laid });

  // Every card still in a hand goes to the claimer's team, wherever it sits.
  const rest = [0, 1, 2, 3].flatMap((i) => state.hands[(seat + i) % 4]!);
  state.cardPoints[team] += rest.reduce((sum, c) => sum + points(c, contract), 0) + LAST_TRICK_BONUS;
  state.tricksWon[team] += TRICKS_PER_ROUND - state.tricksPlayed;
  state.tricksPlayed = TRICKS_PER_ROUND;
  state.collected.push(...rest);
  state.hands = [[], [], [], []];
  if (!state.announcementsRevealed) revealAnnouncements(state, events);
  finishRound(state, events);
  return { ok: true, state, events };
}

function finishRound(state: GameState, events: GameEvent[]): void {
  const contract = state.contract!;
  const announcements = resolveDeclared(state.declared, state.belots).points;
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
  startRound(state, state.round + 1, nextSeat(state.dealer), state.collected, 0);
  return { ok: true, state, events };
}
