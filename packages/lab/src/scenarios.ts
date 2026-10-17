/**
 * Bidding situations where good players agree on the bid: the bot's choice over many seeds (the
 * cards it cannot see and its sampling change with the seed) next to the expected bid.
 *
 *   pnpm --filter @belot/lab scenarios [--bot normal] [--seeds 20]
 */
import { parseArgs } from "node:util";
import { applyAction, newGame, viewFor, type BidAction, type Card, type Contract, type GameState } from "@belot/engine";
import { parseBot } from "./bots";

const { values } = parseArgs({
  options: {
    bot: { type: "string", default: "normal" },
    seeds: { type: "string", default: "20" },
  },
});

const SUIT: Record<string, Card["suit"]> = { "♣": "clubs", "♦": "diamonds", "♥": "hearts", "♠": "spades" };
const parse = (s: string): Card[] => s.split(" ").map((c) => ({ rank: c.slice(0, -1) as Card["rank"], suit: SUIT[c.slice(-1)]! }));
const same = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;

/** A bid written short: a contract ("hearts", "all-trumps"), "pass", "contra" or "recontra". */
type Short = Contract | "pass" | "contra" | "recontra";
const toBid = (b: Short): BidAction => (b === "pass" || b === "contra" || b === "recontra" ? { type: b } : { type: "bid", contract: b });
const short = (b: BidAction): Short => (b.type === "bid" ? b.contract : b.type);

export interface Scenario {
  name: string;
  /** The bidder's five cards. */
  hand: string;
  /**
   * The auction before it, from the first bidder on. The bidder's own earlier bids are included;
   * every bid in it is made whatever the bot would have said.
   */
  before: Short[];
  /** Bids a good player makes here. */
  expected: Short[];
}

export const SCENARIOS: Scenario[] = [
  { name: "Strong hearts over the opponents' clubs", hand: "J♥ 9♥ A♥ 10♠ K♣", before: ["clubs"], expected: ["hearts"] },
  { name: "Jack-nine of hearts over the opponents' clubs", hand: "J♥ 9♥ 7♥ 8♠ 7♣", before: ["clubs"], expected: ["hearts"] },
  // Sitting right after the clubs bidder ("под ръка") makes all trumps likelier, not certain.
  { name: "Three jacks right after the opponent's clubs", hand: "J♥ J♠ J♣ 9♦ A♦", before: ["clubs"], expected: ["all-trumps", "pass"] },
  { name: "Three jacks right before the opponent's clubs", hand: "J♥ J♠ J♣ 9♦ A♦", before: ["clubs", "pass", "pass"], expected: ["all-trumps", "pass"] },
  { name: "Own suit over the partner's: partner bid clubs, I hold diamonds", hand: "J♦ 9♦ A♦ 10♦ 7♠", before: ["clubs", "pass"], expected: ["diamonds", "all-trumps"] },
  { name: "Partner overcalled my suit: raise to all trumps", hand: "J♦ 9♦ A♦ 7♠ 8♣", before: ["diamonds", "pass", "hearts", "pass"], expected: ["all-trumps"] },
  { name: "Partner bid no trumps: no all trumps on two jacks", hand: "J♠ J♥ 9♠ A♦ 7♣", before: ["no-trumps", "pass"], expected: ["pass"] },
  { name: "Partner bid no trumps: all trumps with a carré of jacks", hand: "J♠ J♥ J♦ J♣ 7♣", before: ["no-trumps", "pass"], expected: ["all-trumps", "pass"] },
  { name: "Aces and tens over the opponents' clubs: no trumps", hand: "A♥ A♠ 10♠ K♥ 8♦", before: ["clubs"], expected: ["no-trumps"] },
];

/** Good practice rather than rule: `bid` is likelier in the first scenario than in the second. */
export const TENDENCIES: { more: string; less: string; bid: Short }[] = [
  { more: "Three jacks right after the opponent's clubs", less: "Three jacks right before the opponent's clubs", bid: "all-trumps" },
];

/** A bidding state where the seat on turn holds `hand`, after the bids in `before`. */
function setUp(s: Scenario, seed: number): GameState {
  const must = (state: GameState, action: Parameters<typeof applyAction>[2]) => {
    const r = applyAction(state, state.turn, action);
    if (!r.ok) throw new Error(`${s.name}: ${r.error}`);
    return r.state;
  };
  const hand = parse(s.hand);
  let state = newGame(seed, seed % 4);
  state = must(state, { type: "cut", position: 1 + (seed % 31) });
  state = must(state, { type: "deal", lucky: false });
  const me = (state.turn + s.before.length) % 4;
  // Swap the wanted cards into the bidder's hand from wherever they were dealt.
  for (const want of hand) {
    const mine = state.hands[me]!;
    if (mine.some((c) => same(c, want))) continue;
    const give = mine.findIndex((c) => !hand.some((h) => same(h, c)));
    for (const pile of [...state.hands, state.talon]) {
      const at = pile.findIndex((c) => same(c, want));
      if (at < 0) continue;
      pile[at] = mine[give]!;
      mine[give] = want;
      break;
    }
  }
  for (const b of s.before) state = must(state, { type: "bid", bid: toBid(b) });
  return state;
}

const bot = parseBot(values.bot!);
const seeds = Number(values.seeds);
let good = 0;
const rates = new Map<string, Map<Short, number>>();
for (const s of SCENARIOS) {
  const counts = new Map<Short, number>();
  for (let seed = 1; seed <= seeds; seed++) {
    const state = setUp(s, 7000 + seed);
    const action = bot(viewFor(state, state.turn), seed);
    if (action?.type !== "bid") throw new Error(`${s.name}: expected a bid`);
    counts.set(short(action.bid), (counts.get(short(action.bid)) ?? 0) + 1);
  }
  rates.set(s.name, counts);
  const right = s.expected.reduce((n, b) => n + (counts.get(b) ?? 0), 0);
  good += right / seeds;
  const shown = [...counts].sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b} ${n}`).join(", ");
  console.log(`${right === seeds ? "✓" : right >= seeds / 2 ? "~" : "✗"} ${String(Math.round((right / seeds) * 100)).padStart(3)}%  ${s.name}  [${s.hand}${s.before.length ? ` after ${s.before.join(", ")}` : ""}]  expected ${s.expected.join(" or ")}; bot: ${shown}`);
}
for (const t of TENDENCIES) {
  const more = rates.get(t.more)?.get(t.bid) ?? 0;
  const less = rates.get(t.less)?.get(t.bid) ?? 0;
  console.log(`${more > less ? "✓" : "✗"} ${t.bid} ${more}/${seeds} "${t.more}" against ${less}/${seeds} "${t.less}"`);
}
console.log(`\n${values.bot}: ${((good / SCENARIOS.length) * 100).toFixed(0)}% of the expected bids`);
