import { isTrump, points, strength, SUITS, type Card, type Contract, type Suit } from "./cards";
import { legalActions, type GameAction, type GameState } from "./game";
import { isPartner, trickWinner } from "./tricks";

/** Rough worth of holding a card as trump while bidding on the first five cards. */
const BID_VALUE: Record<string, number> = { J: 20, "9": 14, A: 11, "10": 10, K: 4, Q: 3, "8": 0, "7": 0 };
const BID_THRESHOLD = 34;

function suitScore(hand: readonly Card[], suit: Suit): number {
  const cards = hand.filter((c) => c.suit === suit);
  return cards.reduce((sum, c) => sum + BID_VALUE[c.rank]!, 0) + cards.length * 2;
}

function chooseBid(state: GameState, seat: number, options: GameAction[]): GameAction {
  const pass = options.find((a) => a.type === "bid" && a.bid.type === "pass")!;
  const hand = state.hands[seat]!;
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

function choosePlay(state: GameState, seat: number, options: GameAction[]): GameAction {
  const contract = state.contract!.contract as Contract;
  const cards = options.map((a) => (a as { card: Card }).card);
  const play = (card: Card): GameAction => ({ type: "play", card });
  const byStrength = (a: Card, b: Card) => strength(a, contract) - strength(b, contract);
  const byValue = (a: Card, b: Card) => points(a, contract) - points(b, contract) || byStrength(a, b);

  if (cards.length === 1) return play(cards[0]!);

  if (state.trick.length === 0) {
    const plain = cards.filter((c) => !isTrump(c, contract));
    const pool = plain.length > 0 ? plain : cards;
    return play([...pool].sort(byStrength).at(-1)!);
  }

  const winning = trickWinner(state.trick, contract);
  if (isPartner(seat, winning)) return play([...cards].sort(byValue).at(-1)!);

  const winners = cards.filter((c) => trickWinner([...state.trick, { seat, card: c }], contract) === seat);
  if (winners.length > 0) return play([...winners].sort(byStrength)[0]!);
  return play([...cards].sort(byValue)[0]!);
}

/** A simple, legal-by-construction move for a computer player. */
export function chooseBotAction(state: GameState, seat: number): GameAction | null {
  const options = legalActions(state, seat);
  if (options.length === 0) return null;
  if (state.phase === "cutting") return { type: "cut", position: 8 + ((state.seed + state.dealIndex * 7) % 17) };
  if (state.phase === "bidding") return chooseBid(state, seat, options);
  if (state.phase === "playing") return choosePlay(state, seat, options);
  return options[0]!;
}
