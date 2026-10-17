/**
 * Bot against bot on duplicate deals: every seed is played twice, once with each bot on each team,
 * so the luck of the cards cancels out and what is left is the difference in play.
 *
 *   pnpm arena --a basic --b random --deals 1000 [--games 200] [--seed 1] [--threads 10]
 *
 * A bot may carry tuning numbers: --a bidder:samples=100,bidMargin=3
 */
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";
import { teamOf, type RoundSummary } from "@belot/engine";
import { parseBot } from "./bots";
import { runJob, type Job, type JobResult } from "./match";
import { meanEstimate, rateEstimate, type Estimate } from "./stats";

const { values } = parseArgs({
  options: {
    a: { type: "string", default: "basic" },
    b: { type: "string", default: "random" },
    deals: { type: "string", default: "1000" },
    games: { type: "string", default: "0" },
    seed: { type: "string", default: "1" },
    threads: { type: "string", default: String(availableParallelism()) },
  },
});

/** Splits the seeds over worker threads and gathers the results in seed order. */
async function run(kind: Job["kind"], count: number): Promise<JobResult[]> {
  const threads = Math.max(1, Math.min(Number(values.threads), count));
  const jobs: Job[] = Array.from({ length: threads }, (_, i) => ({
    a: nameA,
    b: nameB,
    from: first + Math.floor((count * i) / threads),
    to: first + Math.floor((count * (i + 1)) / threads),
    kind,
  }));
  if (threads === 1) return [runJob(jobs[0]!)];
  return Promise.all(
    jobs.map(
      (job) =>
        new Promise<JobResult>((resolve, reject) => {
          const worker = new Worker(new URL("./worker-boot.mjs", import.meta.url));
          worker.once("message", (r: JobResult) => {
            resolve(r);
            void worker.terminate();
          });
          worker.once("error", reject);
          worker.postMessage(job);
        }),
    ),
  );
}

interface Side {
  points: number[];
  taken: number;
  made: number;
  kinds: { suit: number; nt: number; at: number };
  doubled: number;
}

const newSide = (): Side => ({ points: [], taken: 0, made: 0, kinds: { suit: 0, nt: 0, at: 0 }, doubled: 0 });

function record(side: Side, round: RoundSummary, team: 0 | 1): void {
  side.points.push(round.result.recorded[team]);
  if (teamOf(round.bidder) !== team) return;
  side.taken += 1;
  if (round.result.outcome === "success") side.made += 1;
  if (round.multiplier > 1) side.doubled += 1;
  if (round.contract === "no-trumps") side.kinds.nt += 1;
  else if (round.contract === "all-trumps") side.kinds.at += 1;
  else side.kinds.suit += 1;
}

const nameA = values.a!;
const nameB = values.b!;
const deals = Number(values.deals);
const games = Number(values.games);
const first = Number(values.seed);
parseBot(nameA);
parseBot(nameB);

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pm = (e: Estimate, f: (x: number) => string, g = f) => `${f(e.mean)} (95% ±${g(e.half)})`;
const signed = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2);
const row = (label: string, a: string, b: string) => console.log(label.padEnd(22) + a.padStart(14) + b.padStart(14));

const started = performance.now();

if (deals > 0) {
  const sideA = newSide();
  const sideB = newSide();
  const margins: number[] = [];
  const results = await run("deals", deals);
  const clockA = { ms: 0, moves: 0 };
  const clockB = { ms: 0, moves: 0 };
  for (const r of results) {
    clockA.ms += r.clocks[0].ms;
    clockA.moves += r.clocks[0].moves;
    clockB.ms += r.clocks[1].ms;
    clockB.moves += r.clocks[1].moves;
  }
  for (const [r1, r2] of results.flatMap((r) => r.deals)) {
    record(sideA, r1, 0);
    record(sideB, r1, 1);
    record(sideB, r2, 0);
    record(sideA, r2, 1);
    margins.push((r1.result.recorded[0] - r1.result.recorded[1] + r2.result.recorded[1] - r2.result.recorded[0]) / 2);
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const share = (n: number, of: number) => (of === 0 ? "-" : pct(n / of));
  const rounds = deals * 2;

  console.log(`\n${nameA} vs ${nameB} · ${deals} deals, each played from both seats · seeds ${first}–${first + deals - 1}\n`);
  row("", nameA, nameB);
  row("points per deal", avg(sideA.points).toFixed(2), avg(sideB.points).toFixed(2));
  row("contracts taken", share(sideA.taken, rounds), share(sideB.taken, rounds));
  row("  made", share(sideA.made, sideA.taken), share(sideB.made, sideB.taken));
  row("  doubled", share(sideA.doubled, sideA.taken), share(sideB.doubled, sideB.taken));
  const mix = (s: Side) => `${s.kinds.suit}/${s.kinds.nt}/${s.kinds.at}`;
  row("  suit / NT / AT", mix(sideA), mix(sideB));
  row("ms per move", (clockA.ms / clockA.moves).toFixed(3), (clockB.ms / clockB.moves).toFixed(3));
  console.log(`\n${nameA} − ${nameB}: ${pm(meanEstimate(margins), signed, (x) => x.toFixed(2))} recorded points per deal`);
}

if (games > 0) {
  const winsA = (await run("games", games)).reduce((sum, r) => sum + r.wins, 0);
  console.log(`${nameA} won ${pm(rateEstimate(winsA, games * 2), pct)} of ${games * 2} games against ${nameB}`);
}

console.log(`(${((performance.now() - started) / 1000).toFixed(1)}s)\n`);
