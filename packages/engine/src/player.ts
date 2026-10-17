import { BELOT_POINTS } from "./announcements";
import { mulberry32 } from "./deal";
import { smartPolicy } from "./rollout";
import type { GameAction } from "./game";
import { knowledgeOf, sampleHands } from "./knowledge";
import {
  announcementPoints,
  cardIndex,
  cardOf,
  cloneRound,
  contractId,
  maskOf,
  playCard,
  playOut,
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
}

export const DEFAULT_PLAY_TUNING: PlayTuning = { samples: 100, policy: smartPolicy };

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

  for (let n = 0; n < t.samples; n++) {
    const hands = sampleHands(k, mine, rand);
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

