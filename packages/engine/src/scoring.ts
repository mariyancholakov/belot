import type { Contract } from "./cards";

export type Team = 0 | 1;
export type Multiplier = 1 | 2 | 4;

/** Recorded points added for winning every trick (90 raw, see docs/RULES.md). */
export const CAPO_BONUS = 9;
export const TARGET_SCORE = 151;

export interface RoundInput {
  contract: Contract;
  /** Team that made the winning (highest) bid. */
  bidder: Team;
  /** 1 normally, 2 after contra, 4 after re-contra. */
  multiplier: Multiplier;
  /** Points from cards won, including the +10 for the last trick. */
  cardPoints: readonly [number, number];
  /** Announcement points (terca, fifty, hundred, carré, belot). */
  announcements: readonly [number, number];
  /** Team that won all 8 tricks, if any. */
  capo: Team | null;
  /** Recorded points hanging from earlier tied rounds. */
  hanging: number;
}

export interface RoundResult {
  /** Points each team writes down this round. */
  recorded: [number, number];
  /** Points hanging to the next played round. */
  hanging: number;
  outcome: "success" | "inside" | "tie";
}

/** Raw points -> recorded points, using the rounding rule for the contract. */
export function toRecorded(raw: number, contract: Contract, hasMore: boolean): number {
  const tens = Math.floor(raw / 10);
  const units = raw % 10;
  let threshold: number;
  if (contract === "no-trumps") threshold = 6;
  else if (contract === "all-trumps") threshold = hasMore ? 5 : 4;
  else threshold = hasMore ? 7 : 6;
  return tens + (units >= threshold ? 1 : 0);
}

export function scoreRound(input: RoundInput): RoundResult {
  const { contract, bidder, multiplier, capo } = input;
  const opponent: Team = bidder === 0 ? 1 : 0;
  const factor = contract === "no-trumps" ? 2 : 1;

  const raw: [number, number] = [
    (input.cardPoints[0] + input.announcements[0]) * factor,
    (input.cardPoints[1] + input.announcements[1]) * factor,
  ];

  const rounded: [number, number] = [
    toRecorded(raw[0], contract, raw[0] > raw[1]),
    toRecorded(raw[1], contract, raw[1] > raw[0]),
  ];

  const recorded: [number, number] = [0, 0];
  let hanging = 0;
  let outcome: RoundResult["outcome"];
  let winner: Team | null;

  if (raw[bidder] > raw[opponent]) {
    outcome = "success";
    winner = bidder;
    if (multiplier === 1) {
      recorded[0] = rounded[0];
      recorded[1] = rounded[1];
    } else {
      recorded[bidder] = (rounded[0] + rounded[1]) * multiplier;
    }
  } else if (raw[bidder] < raw[opponent]) {
    outcome = "inside";
    winner = opponent;
    recorded[opponent] = (rounded[0] + rounded[1]) * multiplier;
  } else {
    outcome = "tie";
    winner = null;
    // Equal points: the side that did not bid records them rounded down, the bidder's hang rounded up.
    recorded[opponent] = Math.floor(raw[opponent] / 10) * multiplier;
    hanging = Math.ceil(raw[bidder] / 10) * multiplier;
  }

  // The capo bonus is a premium like the others: contra and re-contra multiply it too.
  if (capo !== null) recorded[capo] += CAPO_BONUS * multiplier;

  // Earlier hanging points go to whoever wins this round; a tie keeps them hanging.
  if (winner !== null) recorded[winner] += input.hanging;
  else hanging += input.hanging;

  return { recorded, hanging, outcome };
}

/** Winning team once someone reaches the target, or null if play continues. A round won with a capo can never end the game: see `finishRound`. */
export function gameWinner(totals: readonly [number, number], target = TARGET_SCORE): Team | null {
  const [a, b] = totals;
  if (a < target && b < target) return null;
  if (a === b) return null;
  return a > b ? 0 : 1;
}
