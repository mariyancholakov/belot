import type { BotPolicy } from "./bot";
import { mulberry32 } from "./deal";
import { applyAction, newGame, type GameAction, type GameState, type RoundSummary } from "./game";
import type { Team } from "./scoring";
import { viewFor } from "./view";

/** The bot of each team: team 0 holds seats 0 and 2, team 1 seats 1 and 3. */
export type Lineup = readonly [BotPolicy, BotPolicy];

const MAX_STEPS = 100_000;

/**
 * Moves that take no skill are made by the table, from the seed alone, so two lineups on the same
 * seed get the same deals whoever sits where: the dealer shuffles when allowed, the cut is fixed,
 * there is no lucky card.
 */
function tableMove(state: GameState): GameAction | null {
  switch (state.phase) {
    case "shuffling":
      return { type: "shuffle" };
    case "cutting":
      return { type: "cut", position: 1 + Math.floor(mulberry32(state.seed * 1009 + state.dealIndex)() * 31) };
    case "dealing":
      return { type: "deal", lucky: false };
    case "roundEnd":
      return { type: "nextRound" };
    default:
      return null;
  }
}

function advance(state: GameState, lineup: Lineup, step: number): GameState {
  if (step > MAX_STEPS) throw new Error(`no result after ${MAX_STEPS} moves (seed ${state.seed})`);
  const seat = state.phase === "roundEnd" ? 0 : state.turn;
  const action = tableMove(state) ?? lineup[seat % 2]!(viewFor(state, seat), (Math.imul(state.seed, 0x9e3779b1) + step) | 0);
  if (!action) throw new Error(`no move for seat ${seat} in ${state.phase} (seed ${state.seed})`);
  const result = applyAction(state, seat, action);
  if (!result.ok) throw new Error(`illegal move by seat ${seat}: ${result.error} (seed ${state.seed})`);
  return result.state;
}

/** One round on a fresh deck from `seed`; deals that everybody passes are redealt within the round. */
export function playRound(lineup: Lineup, seed: number): RoundSummary {
  let state = newGame(seed);
  for (let step = 0; state.history.length === 0; step++) state = advance(state, lineup, step);
  return state.history[0]!;
}

export interface GameResult {
  winner: Team;
  scores: [number, number];
  rounds: RoundSummary[];
}

/** A whole game to 151 from `seed`. */
export function playGame(lineup: Lineup, seed: number): GameResult {
  let state = newGame(seed);
  for (let step = 0; state.phase !== "gameOver"; step++) state = advance(state, lineup, step);
  return { winner: state.winner!, scores: state.scores, rounds: state.history };
}
