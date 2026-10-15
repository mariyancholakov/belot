import type { Announcement } from "./announcements";
import type { Card } from "./cards";
import type { BidAction, BidOutcome } from "./bidding";
import { legalActions, type GameAction, type GameState, type Phase, type RoundSummary } from "./game";
import type { Team } from "./scoring";
import type { Play } from "./tricks";

/** What one player is allowed to know about the game. */
export interface GameView {
  seat: number;
  phase: Phase;
  round: number;
  dealer: number;
  turn: number;
  /** Own cards only. */
  hand: Card[];
  /** Number of cards each seat holds. */
  handCounts: number[];
  trick: Play[];
  lastTrick: Play[] | null;
  bidLog: { seat: number; bid: BidAction }[];
  /** Highest bid so far while bidding. */
  highestBid: { seat: number; contract: string } | null;
  contract: BidOutcome | null;
  tricksWon: [number, number];
  /** Announcements that count, shown to everyone after the first trick. */
  announcements: { seat: number; announcements: Announcement[] }[] | null;
  scores: [number, number];
  hanging: number;
  history: RoundSummary[];
  winner: Team | null;
  /** Actions this seat may take right now. */
  legalActions: GameAction[];
}

export function viewFor(state: GameState, seat: number): GameView {
  const revealed = state.announcementsRevealed && state.announcements;
  return {
    seat,
    phase: state.phase,
    round: state.round,
    dealer: state.dealer,
    turn: state.turn,
    hand: state.hands[seat] ?? [],
    handCounts: state.hands.map((h) => h.length),
    trick: state.trick,
    lastTrick: state.lastTrick,
    bidLog: state.bidLog,
    highestBid: state.bidding.highest,
    contract: state.contract,
    tricksWon: state.tricksWon,
    announcements: revealed
      ? state.announcements!.counted
          .map((announcements, s) => ({ seat: s, announcements }))
          .filter((x) => x.announcements.length > 0)
      : null,
    scores: state.scores,
    hanging: state.hanging,
    history: state.history,
    winner: state.winner,
    legalActions: legalActions(state, seat),
  };
}
