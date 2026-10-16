import { chooseBid, DEFAULT_BID_TUNING, type BidTuning } from "./bidder";
import { chooseCard, DEFAULT_PLAY_TUNING, type PlayTuning } from "./player";
import { POLICIES } from "./rollout";
import { cardEquals, isTrump, points, strength, SUITS, type Card, type Contract, type Suit } from "./cards";
import { mulberry32 } from "./deal";
import type { GameAction, GameState } from "./game";
import { isPartner, trickWinner } from "./tricks";
import { viewFor, type GameView } from "./view";

/**
 * A computer player. It sees only what a person in its seat would see, and draws any randomness
 * from `seed`, so the same view and seed always give the same move.
 */
export type BotPolicy = (view: GameView, seed: number) => GameAction | null;

/** Rough worth of holding a card as trump while bidding on the first five cards. */
const BID_VALUE: Record<string, number> = { J: 20, "9": 14, A: 11, "10": 10, K: 4, Q: 3, "8": 0, "7": 0 };
const BID_THRESHOLD = 34;

function suitScore(hand: readonly Card[], suit: Suit): number {
  const cards = hand.filter((c) => c.suit === suit);
  return cards.reduce((sum, c) => sum + BID_VALUE[c.rank]!, 0) + cards.length * 2;
}

function chooseSuitBid(hand: readonly Card[], options: GameAction[]): GameAction {
  const pass = options.find((a) => a.type === "bid" && a.bid.type === "pass")!;
  let best: GameAction | null = null;
  let bestScore = BID_THRESHOLD;
  for (const suit of SUITS) {
    const score = suitScore(hand, suit);
    const option = options.find((a) => a.type === "bid" && a.bid.type === "bid" && a.bid.contract === suit);
    if (option && score > bestScore) {
      best = option;
      bestScore = score;
    }
  }
  return best ?? pass;
}

function choosePlay(view: GameView, options: GameAction[]): GameAction {
  const contract = view.contract!.contract as Contract;
  const cards = options.flatMap((a) => (a.type === "play" ? [a.card] : []));
  const play = (card: Card): GameAction => ({ type: "play", card });
  const byStrength = (a: Card, b: Card) => strength(a, contract) - strength(b, contract);
  const byValue = (a: Card, b: Card) => points(a, contract) - points(b, contract) || byStrength(a, b);

  if (cards.length === 1) return play(cards[0]!);

  if (view.trick.length === 0) {
    const plain = cards.filter((c) => !isTrump(c, contract));
    const pool = plain.length > 0 ? plain : cards;
    return play([...pool].sort(byStrength).at(-1)!);
  }

  const winning = trickWinner(view.trick, contract);
  if (isPartner(view.seat, winning)) return play([...cards].sort(byValue).at(-1)!);

  const winners = cards.filter((c) => trickWinner([...view.trick, { seat: view.seat, card: c }], contract) === view.seat);
  if (winners.length > 0) return play([...winners].sort(byStrength)[0]!);
  return play([...cards].sort(byValue)[0]!);
}

type Choose = (view: GameView, seed: number) => GameAction;

/** A bot from a way to bid and a way to play; the other decisions are the same for every bot. */
export function makeBot(bid: Choose, play: Choose): BotPolicy {
  return (view, seed) => {
    const options = view.legalActions;
    if (options.length === 0) return null;
    if (view.phase === "shuffling") return { type: "shuffle" };
    if (view.phase === "dealing") return { type: "deal", lucky: false };
    if (view.phase === "cutting") return { type: "cut", position: 8 + (Math.abs(seed) % 17) };
    if (view.phase === "bidding") return bid(view, seed);
    if (view.phase === "playing") {
      if (options.some((a) => a.type === "announce")) return { type: "announce", declare: true };
      if (options.some((a) => a.type === "claim")) return { type: "claim", belot: true };
      const action = play(view, seed);
      return action.type === "play" && view.belotCards.some((c) => cardEquals(c, action.card)) ? { ...action, belot: true } : action;
    }
    return options[0]!;
  };
}

const basicBid: Choose = (view) => chooseSuitBid(view.hand, view.legalActions);
const basicPlay: Choose = (view) => choosePlay(view, view.legalActions);

/** The first bot: bids a suit on a strong five-card start, then plays the current trick greedily. */
export const basicBot: BotPolicy = makeBot(basicBid, basicPlay);

/** Any legal move, picked at random: the floor every other bot must clear. */
export const randomBot: BotPolicy = (view, seed) => {
  const options = view.legalActions;
  if (options.length === 0) return null;
  return options[Math.floor(mulberry32(seed)() * options.length)]!;
};

/** Numbers that tune a bot, by name (each bot documents its own). */
export type BotParams = Record<string, number>;

/** Numbers named `<prefix>.<key>`, without the prefix. */
function scoped(p: BotParams, prefix: string): BotParams {
  const out: BotParams = {};
  for (const [key, value] of Object.entries(p)) if (key.startsWith(prefix + ".")) out[key.slice(prefix.length + 1)] = value;
  return out;
}

/** Bid tuning from `bid.*` numbers; `bid.rollout` picks the playing policy of the simulated rounds. */
function bidTuning(p: BotParams): BidTuning {
  const { rollout, ...rest } = scoped(p, "bid");
  return { ...DEFAULT_BID_TUNING, ...rest, ...(rollout !== undefined ? { policy: POLICIES[rollout]! } : {}) };
}

function playTuning(p: BotParams): PlayTuning {
  const { rollout, ...rest } = scoped(p, "play");
  return { ...DEFAULT_PLAY_TUNING, ...rest, ...(rollout !== undefined ? { policy: POLICIES[rollout]! } : {}) };
}

/** Every bot the arena knows, built from optional tuning numbers. */
export const BOTS: Record<string, (params: BotParams) => BotPolicy> = {
  basic: () => basicBot,
  /** Bids by simulating the round (no trumps, all trumps, contra, reading the other bids); plays like the basic bot. */
  bidder: (p) => makeBot((view, seed) => chooseBid(view, seed, bidTuning(p)), basicPlay),
  /** Bids like `bidder` and plays each card by sampling the unseen hands. */
  mc: (p) => makeBot((view, seed) => chooseBid(view, seed, bidTuning(p)), (view, seed) => chooseCard(view, seed, playTuning(p))),
  random: () => randomBot,
};

/** The move the server plays for a bot seat, or for a player whose clock ran out. */
export function chooseBotAction(state: GameState, seat: number): GameAction | null {
  return basicBot(viewFor(state, seat), state.seed + state.dealIndex * 7);
}
