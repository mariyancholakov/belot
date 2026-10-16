import { playGame, playRound, type BotPolicy, type Lineup, type RoundSummary } from "@belot/engine";
import { parseBot } from "./bots";

/** What a worker plays: a range of seeds, each from both seatings. */
export interface Job {
  a: string;
  b: string;
  from: number;
  to: number;
  kind: "deals" | "games";
}

export interface Clock {
  ms: number;
  moves: number;
}

export interface JobResult {
  /** Per seed: the round with A as team 0, then with A as team 1. */
  deals: [RoundSummary, RoundSummary][];
  /** Games A won, out of two per seed. */
  wins: number;
  clocks: [Clock, Clock];
}

/** Wraps a bot to count its moves and the time it spends on them. */
function timed(policy: BotPolicy, clock: Clock): BotPolicy {
  return (view, seed) => {
    const t = performance.now();
    const action = policy(view, seed);
    clock.ms += performance.now() - t;
    clock.moves += 1;
    return action;
  };
}

export function runJob(job: Job): JobResult {
  const clocks: [Clock, Clock] = [{ ms: 0, moves: 0 }, { ms: 0, moves: 0 }];
  const A = timed(parseBot(job.a), clocks[0]);
  const B = timed(parseBot(job.b), clocks[1]);
  const AB: Lineup = [A, B];
  const BA: Lineup = [B, A];
  const result: JobResult = { deals: [], wins: 0, clocks };
  for (let seed = job.from; seed < job.to; seed++) {
    if (job.kind === "deals") result.deals.push([playRound(AB, seed), playRound(BA, seed)]);
    else {
      if (playGame(AB, seed).winner === 0) result.wins += 1;
      if (playGame(BA, seed).winner === 1) result.wins += 1;
    }
  }
  return result;
}
