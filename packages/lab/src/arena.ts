/**
 * Bot against bot on duplicate deals: every seed is played twice, once with each bot on each team,
 * so the luck of the cards cancels out and what is left is the difference in play.
 *
 *   pnpm arena --a basic --b random --deals 1000 [--games 200] [--seed 1]
 */
import { parseArgs } from "node:util";
import { BOTS, playGame, playRound, teamOf, type BotPolicy, type Lineup, type RoundSummary } from "@belot/engine";
import { meanEstimate, rateEstimate, type Estimate } from "./stats";

const { values } = parseArgs({
  options: {
    a: { type: "string", default: "basic" },
    b: { type: "string", default: "random" },
    deals: { type: "string", default: "1000" },
    games: { type: "string", default: "0" },
    seed: { type: "string", default: "1" },
  },
});

function bot(name: string): BotPolicy {
  const policy = BOTS[name];
  if (!policy) throw new Error(`unknown bot "${name}"; known: ${Object.keys(BOTS).join(", ")}`);
  return policy;
}

/** Wraps a bot to count its moves and the time it spends on them. */
function timed(policy: BotPolicy) {
  const clock = { ms: 0, moves: 0 };
  const wrapped: BotPolicy = (view, seed) => {
    const t = performance.now();
    const action = policy(view, seed);
    clock.ms += performance.now() - t;
    clock.moves += 1;
    return action;
  };
  return { wrapped, clock };
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
const A = timed(bot(nameA));
const B = timed(bot(nameB));
const AB: Lineup = [A.wrapped, B.wrapped];
const BA: Lineup = [B.wrapped, A.wrapped];

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pm = (e: Estimate, f: (x: number) => string, g = f) => `${f(e.mean)} (95% ±${g(e.half)})`;
const signed = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2);
const row = (label: string, a: string, b: string) => console.log(label.padEnd(22) + a.padStart(14) + b.padStart(14));

const started = performance.now();

if (deals > 0) {
  const sideA = newSide();
  const sideB = newSide();
  const margins: number[] = [];
  for (let seed = first; seed < first + deals; seed++) {
    const r1 = playRound(AB, seed);
    const r2 = playRound(BA, seed);
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
  row("ms per move", (A.clock.ms / A.clock.moves).toFixed(3), (B.clock.ms / B.clock.moves).toFixed(3));
  console.log(`\n${nameA} − ${nameB}: ${pm(meanEstimate(margins), signed, (x) => x.toFixed(2))} recorded points per deal`);
}

if (games > 0) {
  let winsA = 0;
  for (let seed = first; seed < first + games; seed++) {
    if (playGame(AB, seed).winner === 0) winsA += 1;
    if (playGame(BA, seed).winner === 1) winsA += 1;
  }
  console.log(`${nameA} won ${pm(rateEstimate(winsA, games * 2), pct)} of ${games * 2} games against ${nameB}`);
}

console.log(`(${((performance.now() - started) / 1000).toFixed(1)}s)\n`);
