import { BELOT_POINTS } from "./announcements";
import { bidLikelihoods } from "./bidder";
import { mulberry32 } from "./deal";
import { smartPolicy } from "./rollout";
import type { GameAction } from "./game";
import { knowledgeOf, sampleHands, type Knowledge } from "./knowledge";
import {
  announcementPoints,
  cardIndex,
  cardOf,
  cloneRound,
  indices,
  contractId,
  maskOf,
  playCard,
  playOut,
  popcount,
  POINTS,
  roundResult,
  trickWinnerSim,
  type SimPolicy,
  type SimRound,
} from "./sim";
import type { Team } from "./scoring";
import type { GameView } from "./view";

/**
 * Card play by sampling: deal the unseen cards many times in ways that fit what the bot has seen,
 * play each legal card followed by the rest of the round in every deal, and keep the card that
 * scores best for the team on average. The number of deals sets how strong the bot is.
 */

export interface PlayTuning {
  samples: number;
  /** How the simulated rounds are played after the card being tried. */
  policy: SimPolicy;
  /** How much the bids shape the deals (0 ignores them), as in the bidder's `inference`. */
  bids: number;
  /** Deals drawn per deal kept when the bids shape them: the kept ones are picked by weight. */
  pool: number;
}

export const DEFAULT_PLAY_TUNING: PlayTuning = { samples: 100, policy: smartPolicy, bids: 0, pool: 4 };

/** The round as this seat sees it, with only its own hand filled in. */
export function roundFromView(view: GameView): SimRound {
  const outcome = view.contract!;
  const c = contractId(outcome.contract);
  const cards = view.plays.map((p) => cardIndex(p.card));
  const done = cards.length - view.trick.length;
  const points: [number, number] = [0, 0];
  for (let start = 0; start < done; start += 4) {
    const trick = cards.slice(start, start + 4);
    const winner = trickWinnerSim(trick, view.plays[start]!.seat, c);
    points[(winner & 1) as Team] += trick.reduce((sum, card) => sum + POINTS[c]![card]!, 0);
  }
  const bonus: [number, number] = [0, 0];
  view.belots.forEach((suits, seat) => (bonus[(seat & 1) as Team] += suits.length * BELOT_POINTS));
  for (const { seat, announcements } of view.announcements ?? []) bonus[(seat & 1) as Team] += announcements.reduce((sum, a) => sum + a.points, 0);
  const hands = [0, 0, 0, 0];
  hands[view.seat] = maskOf(view.hand);
  return {
    contract: c,
    bidder: outcome.bidder,
    multiplier: outcome.multiplier,
    hands,
    trick: view.trick.map((p) => cardIndex(p.card)),
    leader: view.trick[0]?.seat ?? view.seat,
    turn: view.seat,
    tricksPlayed: done / 4,
    tricks: [view.tricksWon[0], view.tricksWon[1]],
    points,
    bonus,
    played: maskOf(view.plays.map((p) => p.card)),
    hanging: view.hanging,
  };
}

/** Average margin for this seat's team after each legal card, over the same sampled deals. */
export function cardValues(view: GameView, seed: number, t: PlayTuning = DEFAULT_PLAY_TUNING): { card: number; value: number }[] {
  const legal = view.legalActions.flatMap((a) => (a.type === "play" ? [cardIndex(a.card)] : []));
  const base = roundFromView(view);
  const k = knowledgeOf(view);
  const mine = base.hands[view.seat]!;
  const team = view.seat & 1;
  const rand = mulberry32(seed);
  const totals = legal.map(() => 0);
  // Before the first trick is over nobody has shown announcements: count what the deal holds.
  const guessAnnouncements = view.announcements === null;
  const playedBy = [0, 0, 0, 0];
  for (const p of view.plays) playedBy[p.seat]! |= maskOf([p.card]);

  for (const hands of sampleDeals(view, k, mine, playedBy, rand, t)) {
    const start = cloneRound(base);
    start.hands = hands;
    if (guessAnnouncements) {
      const ann = announcementPoints(hands.map((h, seat) => h | playedBy[seat]!));
      start.bonus[0] += ann[0];
      start.bonus[1] += ann[1];
    }
    legal.forEach((card, i) => {
      const r = cloneRound(start);
      playCard(r, card);
      playOut(r, t.policy);
      const rec = roundResult(r).recorded;
      totals[i]! += rec[team]! - rec[1 - team]!;
    });
  }
  return legal.map((card, i) => ({ card, value: totals[i]! / t.samples }));
}

/**
 * Deals of the unseen cards that fit the play so far. With `bids` on, more deals are drawn than
 * needed, each is weighed by how likely its hands were to bid as they did (averaged over a few
 * random five of the eight cards each seat started with, since the bot cannot tell which came first),
 * and the deals kept are drawn by weight.
 */
export function sampleDeals(view: GameView, k: Knowledge, mine: number, playedBy: readonly number[], rand: () => number, t: PlayTuning): number[][] {
  const likely = bidLikelihoods(view);
  const informative = likely.some((l, seat) => l && seat !== view.seat);
  if (t.bids <= 0 || !informative) return Array.from({ length: t.samples }, () => sampleHands(k, mine, rand));
  const drawn = Array.from({ length: t.samples * Math.max(1, t.pool) }, () => sampleHands(k, mine, rand));
  const lucky = view.lucky ? { seat: view.lucky.seat, bit: maskOf([view.lucky.card]) } : null;
  const weights = drawn.map((hands) => {
    let w = 1;
    for (let seat = 0; seat < 4; seat++) {
      const l = likely[seat];
      if (seat === view.seat || !l) continue;
      const start = hands[seat]! | playedBy[seat]!;
      const keep = lucky?.seat === seat ? lucky.bit : 0;
      let sum = 0;
      for (let i = 0; i < SUBSETS; i++) sum += l(firstFive(start, keep, rand));
      w *= sum / SUBSETS;
    }
    return Math.pow(w, t.bids);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return drawn.slice(0, t.samples);
  // Systematic resampling: one random offset, evenly spaced picks along the running weight.
  const out: number[][] = [];
  const step = sum / t.samples;
  let pick = rand() * step;
  let run = 0;
  for (let i = 0; i < drawn.length && out.length < t.samples; i++) {
    run += weights[i]!;
    while (pick < run && out.length < t.samples) {
      out.push(drawn[i]!);
      pick += step;
    }
  }
  while (out.length < t.samples) out.push(drawn[drawn.length - 1]!);
  return out;
}

/** Random five-card starts averaged per seat: the likelihood of a hand over the cards it may have bid on. */
const SUBSETS = 4;

/** Five of the eight cards in `hand`, at random, always keeping the `keep` cards. */
function firstFive(hand: number, keep: number, rand: () => number): number {
  const rest = indices(hand & ~keep);
  let out = keep;
  for (let need = 5 - popcount(keep), i = 0; need > 0; i++, need--) {
    const j = i + Math.floor(rand() * (rest.length - i));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    out |= 1 << rest[i]!;
  }
  return out;
}

/** The legal card with the best average result. */
export function chooseCard(view: GameView, seed: number, t: PlayTuning = DEFAULT_PLAY_TUNING): GameAction {
  const plays = view.legalActions.filter((a) => a.type === "play");
  if (plays.length === 1) return plays[0]!;
  let best = -Infinity;
  let card = -1;
  for (const v of cardValues(view, seed, t)) {
    if (v.value > best) {
      best = v.value;
      card = v.card;
    }
  }
  return { type: "play", card: cardOf(card) };
}

