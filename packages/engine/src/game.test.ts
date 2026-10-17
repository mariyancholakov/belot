import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "./cards";
import { applyAction, canClaim, cutterOf, legalActions, newGame, type GameAction, type GameState } from "./game";

/** Tiny seeded RNG for the test players. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A new game with the deck already cut, so it is ready for bidding. */
function startedGame(seed: number, dealer = 0, position = 16, lucky = false): GameState {
  return dealCut(newGame(seed, dealer), position, lucky);
}

/** Cut the deck and deal, from whatever state is waiting for the cut. */
function dealCut(s: GameState, position = 16, lucky = false): GameState {
  const cut = applyAction(s, cutterOf(s.dealer), { type: "cut", position });
  if (!cut.ok) throw new Error(cut.error);
  const dealt = applyAction(cut.state, s.dealer, { type: "deal", lucky });
  if (!dealt.ok) throw new Error(dealt.error);
  return dealt.state;
}

function seatToAct(state: GameState): number {
  if (state.phase === "roundEnd") return 0;
  return state.turn;
}

function chooseAction(state: GameState, rand: () => number): { seat: number; action: GameAction } {
  const seat = seatToAct(state);
  const options = legalActions(state, seat);
  expect(options.length).toBeGreaterThan(0);
  // Bias bidding towards passing so rounds actually get played.
  if (state.phase === "bidding") {
    const pass = options.find((o) => o.type === "bid" && o.bid.type === "pass")!;
    if (rand() < 0.6) return { seat, action: pass };
  }
  return { seat, action: options[Math.floor(rand() * options.length)]! };
}

function playGame(seed: number) {
  const rand = rng(seed * 7919 + 1);
  let state = newGame(seed, seed % 4);
  let steps = 0;
  while (state.phase !== "gameOver") {
    const { seat, action } = chooseAction(state, rand);
    const r = applyAction(state, seat, action);
    if (!r.ok) throw new Error(`seed ${seed} step ${steps}: ${r.error}`);
    expect(r.state.scores[0]).toBeGreaterThanOrEqual(state.scores[0]);
    expect(r.state.scores[1]).toBeGreaterThanOrEqual(state.scores[1]);
    state = r.state;
    if (++steps > 20000) throw new Error(`seed ${seed} did not finish`);
  }
  return state;
}

describe("game", () => {
  it("starts by waiting for the player right of the dealer to cut", () => {
    const s = newGame(1);
    expect(s.phase).toBe("cutting");
    expect(s.turn).toBe(3); // the dealer's left
    expect(s.hands.map((h) => h.length)).toEqual([0, 0, 0, 0]);
    expect(applyAction(s, 1, { type: "cut", position: 10 }).ok).toBe(false);
    expect(applyAction(s, 3, { type: "cut", position: 0 }).ok).toBe(false);
    expect(applyAction(s, 3, { type: "cut", position: 32 }).ok).toBe(false);
    expect(applyAction(s, 3, { type: "bid", bid: { type: "pass" } }).ok).toBe(false);
  });

  it("the cut changes which cards are dealt but keeps the same 32", () => {
    const a = startedGame(1, 0, 5);
    const b = startedGame(1, 0, 20);
    expect(a.hands).not.toEqual(b.hands);
    const all = (s: GameState) => [...s.hands.flat(), ...s.talon].map((c) => c.suit + c.rank).sort();
    expect(all(a)).toEqual(all(b));
    expect(all(a)).toHaveLength(32);
  });

  it("starts in bidding with 5 cards each after the cut", () => {
    const s = startedGame(1);
    expect(s.phase).toBe("bidding");
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(s.turn).toBe(1);
  });

  it("rejects actions out of turn and wrong-phase actions", () => {
    const s = startedGame(1);
    expect(applyAction(s, 3, { type: "bid", bid: { type: "pass" } }).ok).toBe(false);
    expect(applyAction(s, 1, { type: "play", card: s.hands[1]![0]! }).ok).toBe(false);
    expect(applyAction(s, 1, { type: "nextRound" }).ok).toBe(false);
  });

  it("does not mutate the previous state", () => {
    const s = startedGame(1);
    const copy = structuredClone(s);
    applyAction(s, 1, { type: "bid", bid: { type: "bid", contract: "hearts" } });
    expect(s).toEqual(copy);
  });

  it("deals the other 3 cards to each player when bidding ends", () => {
    let s = startedGame(1);
    const moves: [number, GameAction][] = [
      [1, { type: "bid", bid: { type: "bid", contract: "hearts" } }],
      [2, { type: "bid", bid: { type: "pass" } }],
      [3, { type: "bid", bid: { type: "pass" } }],
      [0, { type: "bid", bid: { type: "pass" } }],
    ];
    for (const [seat, a] of moves) {
      const r = applyAction(s, seat, a);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.phase).toBe("playing");
    expect(s.hands.map((h) => h.length)).toEqual([8, 8, 8, 8]);
    expect(s.turn).toBe(1); // player after the dealer leads
    expect(s.contract).toEqual({ bidder: 1, contract: "hearts", multiplier: 1 });
  });

  it("four passes redeal with the next dealer and a new shuffle", () => {
    let s = startedGame(1);
    const before = s.hands;
    for (const seat of [1, 2, 3, 0]) {
      const r = applyAction(s, seat, { type: "bid", bid: { type: "pass" } });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.phase).toBe("cutting");
    expect(s.dealer).toBe(1);
    expect(s.turn).toBe(0);
    const cut = applyAction(s, 0, { type: "cut", position: 16 });
    if (!cut.ok) throw new Error(cut.error);
    expect(cut.state.phase).toBe("dealing");
    const dealt = applyAction(cut.state, 1, { type: "deal", lucky: false });
    if (!dealt.ok) throw new Error(dealt.error);
    expect(dealt.state.phase).toBe("bidding");
    expect(dealt.state.hands).not.toEqual(before);
  });

  it("keeps the same deck after everybody passes and the previous dealer cuts", () => {
    let s = startedGame(1);
    const deckBefore = s.deck.map((c) => c.suit + c.rank);
    for (const seat of [1, 2, 3, 0]) {
      const r = applyAction(s, seat, { type: "bid", bid: { type: "pass" } });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.phase).toBe("cutting");
    expect(s.deck.map((c) => c.suit + c.rank)).toEqual(deckBefore);
    expect(s.fresh).toBe(false);
    expect(s.allPassStreak).toBe(1);
    expect(applyAction(s, 1, { type: "shuffle" }).ok).toBe(false);
  });

  it("offers the dealer a shuffle only after three all-pass deals in a row", () => {
    let s = startedGame(2);
    const passRound = () => {
      for (let i = 0; i < 4; i++) {
        const r = applyAction(s, s.turn, { type: "bid", bid: { type: "pass" } });
        if (!r.ok) throw new Error(r.error);
        s = r.state;
      }
    };
    passRound();
    s = dealCut(s);
    passRound();
    s = dealCut(s);
    expect(s.allPassStreak).toBe(2);
    passRound();
    expect(s.allPassStreak).toBe(3);
    expect(s.phase).toBe("shuffling");
    expect(s.turn).toBe(s.dealer);
    const deckBefore = s.deck.map((c) => c.suit + c.rank);
    expect(applyAction(s, (s.dealer + 1) % 4, { type: "shuffle" }).ok).toBe(false);
    const r = applyAction(s, s.dealer, { type: "shuffle" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.phase).toBe("cutting");
    expect(r.state.fresh).toBe(true);
    expect(r.state.allPassStreak).toBe(0);
    expect(r.state.deck.map((c) => c.suit + c.rank)).not.toEqual(deckBefore);
    expect(r.events).toEqual([{ type: "shuffled", seat: s.dealer }]);
    // Declining keeps the deck and goes straight to the cut.
    const skip = applyAction(s, s.dealer, { type: "skipShuffle" });
    if (!skip.ok) throw new Error(skip.error);
    expect(skip.state.phase).toBe("cutting");
    expect(skip.state.deck.map((c) => c.suit + c.rank)).toEqual(deckBefore);
  });

  it("does not reshuffle between rounds: the next deck is the played cards in order", () => {
    let s = startedGame(3);
    const rand = rng(3);
    while (s.phase !== "roundEnd") {
      const pick = chooseAction(s, rand);
      const r = applyAction(s, pick.seat, pick.action);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      if (s.phase === "cutting") s = dealCut(s); // redeals before a contract is made
      if (s.phase === "gameOver") break;
    }
    if (s.phase !== "roundEnd") return;
    const played = s.collected.map((c) => c.suit + c.rank);
    expect(played).toHaveLength(32);
    const next = applyAction(s, 0, { type: "nextRound" });
    if (!next.ok) throw new Error(next.error);
    expect(next.state.deck.map((c) => c.suit + c.rank)).toEqual(played);
    expect(next.state.collected).toEqual([]);
    expect(next.state.phase).toBe("cutting");
    expect(next.state.fresh).toBe(false);
  });

  it("turns the first dealt card face up when the dealer asks for a lucky card", () => {
    const plain = startedGame(4, 0, 16, false);
    expect(plain.lucky).toBeNull();
    const lucky = startedGame(4, 0, 16, true);
    expect(lucky.lucky).toEqual({ seat: 1, card: lucky.hands[1]![0] });
    expect(lucky.hands).toEqual(plain.hands); // same deal, just revealed
    const cut = applyAction(newGame(4), 3, { type: "cut", position: 16 });
    if (!cut.ok) throw new Error(cut.error);
    expect(applyAction(cut.state, 3, { type: "deal", lucky: true }).ok).toBe(false); // only the dealer deals
  });

  it("is deterministic for a given seed", () => {
    expect(playGame(11)).toEqual(playGame(11));
  });
});

describe("belot call", () => {
  it("is called once, when the first of K+Q of trump is played and the player says so", () => {
    // Find a seed where someone holds K+Q of the bid suit, then play it out.
    for (let seed = 1; seed < 200; seed++) {
      let s = startedGame(seed);
      const bid = (seat: number, b: GameAction) => {
        const r = applyAction(s, seat, b);
        if (!r.ok) throw new Error(r.error);
        s = r.state;
      };
      bid(1, { type: "bid", bid: { type: "bid", contract: "hearts" } });
      for (const seat of [2, 3, 0]) bid(seat, { type: "bid", bid: { type: "pass" } });
      const holder = s.hands.findIndex(
        (h) => h.some((c) => c.suit === "hearts" && c.rank === "K") && h.some((c) => c.suit === "hearts" && c.rank === "Q"),
      );
      if (holder < 0) continue;

      const rand = rng(seed);
      const belots: number[] = [];
      while (s.phase === "playing") {
        const options = legalActions(s, s.turn);
        const pick = options[Math.floor(rand() * options.length)]!;
        const r = applyAction(s, s.turn, pick.type === "play" && s.hands[s.turn]!.length > 0 ? { ...pick, belot: true } : pick);
        if (!r.ok) throw new Error(r.error);
        belots.push(...r.events.flatMap((e) => (e.type === "belot" ? [e.seat] : [])));
        s = r.state;
      }
      expect(belots).toEqual([holder]);
      return;
    }
    throw new Error("no seed with a belot found");
  });
});

describe("random playouts", () => {
  it("300 seeded games always finish with a winner and consistent points", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const state = playGame(seed);
      expect(state.winner).not.toBeNull();
      expect(Math.max(...state.scores)).toBeGreaterThanOrEqual(151);

      for (const round of state.history) {
        const total = round.cardPoints[0] + round.cardPoints[1];
        const expected = round.contract === "all-trumps" ? 258 : round.contract === "no-trumps" ? 130 : 162;
        expect(total).toBe(expected);
      }
    }
  });
});

const k = (rank: Rank, suit: Suit): Card => ({ rank, suit });

/** A game in the playing phase with the given hands, `turn` to lead. */
function playing(hands: Card[][], contract: "hearts" | "no-trumps" | "all-trumps", turn = 0): GameState {
  const s = structuredClone(startedGame(1));
  s.phase = "playing";
  s.contract = { contract, bidder: 0, multiplier: 1 };
  s.hands = hands;
  s.turn = turn;
  s.trick = [];
  s.tricksPlayed = 0;
  s.collected = [];
  return s;
}

describe("announcements are declared by the player", () => {
  const terca = [k("7", "spades"), k("8", "spades"), k("9", "spades")];
  const filler = (n: number) => [k("A", "clubs"), k("10", "diamonds"), k("K", "hearts"), k("8", "clubs"), k("J", "diamonds")].slice(0, n);
  const hands = () => [[...terca, ...filler(5)], [k("7", "hearts"), k("8", "hearts")], [k("9", "hearts")], [k("J", "hearts")]];

  it("asks before the first card and offers nothing else until answered", () => {
    const s = playing(hands(), "hearts");
    expect(legalActions(s, 0).every((a) => a.type === "announce")).toBe(true);
    const r = applyAction(s, 0, { type: "play", card: k("A", "clubs") });
    expect(r.ok).toBe(false);
  });

  it("scores a declared terca and ignores one that was kept quiet", () => {
    for (const declare of [true, false]) {
      const s = playing(hands(), "hearts");
      const r = applyAction(s, 0, { type: "announce", declare });
      if (!r.ok) throw new Error(r.error);
      expect(r.events.some((e) => e.type === "announced")).toBe(declare);
      expect(legalActions(r.state, 0).some((a) => a.type === "play")).toBe(true);
      expect(r.state.decided[0]).toBe(true);
      expect(r.state.declared[0]!.length).toBe(declare ? 1 : 0);
    }
  });

  it("asks nothing in no-trumps", () => {
    const s = playing(hands(), "no-trumps");
    expect(legalActions(s, 0).every((a) => a.type === "play")).toBe(true);
  });
});

describe("belot is only counted when called", () => {
  it("does not count a belot the player stays quiet about", () => {
    const hand = [k("K", "hearts"), k("Q", "hearts"), k("7", "clubs")];
    const s = playing([hand, [k("7", "spades")], [k("8", "spades")], [k("9", "spades")]], "hearts");
    const quiet = applyAction(s, 0, { type: "play", card: k("K", "hearts") });
    expect(quiet.ok && quiet.events.some((e) => e.type === "belot")).toBe(false);
    const called = applyAction(s, 0, { type: "play", card: k("K", "hearts"), belot: true });
    expect(called.ok && called.events.some((e) => e.type === "belot")).toBe(true);
    expect(called.ok && called.state.belots[0]).toEqual(["hearts"]);
  });
});

describe("laying the cards down", () => {
  // Trump is hearts. Seat 0 holds the top trumps and top plain cards, with nothing unseen that could beat them.
  const strong = [k("J", "hearts"), k("9", "hearts"), k("A", "hearts"), k("10", "hearts"), k("K", "hearts"), k("Q", "hearts"), k("8", "hearts"), k("7", "hearts")];

  it("is offered when every card is certain to win, and not otherwise", () => {
    const s = playing([strong, [k("A", "spades")], [k("K", "spades")], [k("Q", "spades")]], "hearts");
    s.decided[0] = true;
    expect(canClaim(s, 0)).toBe(true);
    expect(legalActions(s, 0).some((a) => a.type === "claim")).toBe(true);
    const weak = playing([[k("J", "hearts"), k("A", "spades")], [k("9", "hearts")], [k("7", "clubs")], [k("8", "clubs")]], "hearts");
    expect(canClaim(weak, 0)).toBe(false);
    expect(applyAction(weak, 0, { type: "claim" }).ok).toBe(false);
  });

  it("makes no sense with a single card left", () => {
    const s = playing([[k("J", "hearts")], [k("A", "spades")], [k("K", "spades")], [k("Q", "spades")]], "hearts");
    s.tricksPlayed = 7;
    expect(canClaim(s, 0)).toBe(false);
  });

  it("is only possible when leading", () => {
    const s = playing([strong, [k("A", "spades")], [k("K", "spades")], [k("Q", "spades")]], "hearts", 1);
    expect(canClaim(s, 0)).toBe(false);
  });

  it("gives the claimer's team every remaining card and the last trick", () => {
    const hands = [[k("J", "hearts"), k("9", "hearts")], [k("A", "spades"), k("10", "spades")], [k("7", "clubs"), k("8", "clubs")], [k("Q", "diamonds"), k("K", "diamonds")]];
    const s = playing(hands, "hearts");
    s.tricksPlayed = 6;
    s.cardPoints = [0, 0];
    // everything else has been played, so nothing unseen can beat the claimer
    const all = [] as Card[];
    for (const suit of ["clubs", "diamonds", "hearts", "spades"] as Suit[]) for (const rank of ["7", "8", "9", "10", "J", "Q", "K", "A"] as Rank[]) all.push({ rank, suit });
    s.collected = all.filter((c) => !hands.flat().some((h) => h.rank === c.rank && h.suit === c.suit));
    const r = applyAction(s, 0, { type: "claim" });
    if (!r.ok) throw new Error(r.error);
    // J+9 trump 34, A+10 spades 21, 7+8 clubs 0, Q+K diamonds 7, plus 10 for the last trick
    expect(r.state.cardPoints[0]).toBe(34 + 21 + 7 + 10);
    expect(r.state.cardPoints[1]).toBe(0);
    expect(r.state.tricksWon[0]).toBe(2);
    expect(r.state.hands.every((h) => h.length === 0)).toBe(true);
    expect(["roundEnd", "gameOver"]).toContain(r.state.phase);
    expect(r.state.collected.length).toBe(32);
    const claimed = r.events.find((e) => e.type === "claimed");
    // the other players' cards go face up too, so the table sees the claim is good
    expect(claimed && claimed.type === "claimed" && claimed.hands).toEqual(hands);
  });

  it("lets the claimer call a belot on the cards they lay down", () => {
    const s = playing([[k("K", "hearts"), k("Q", "hearts"), k("J", "hearts")], [k("7", "spades")], [k("8", "spades")], [k("9", "spades")]], "hearts");
    s.tricksPlayed = 5;
    const all: Card[] = [];
    for (const suit of ["clubs", "diamonds", "hearts", "spades"] as Suit[]) for (const rank of ["7", "8", "9", "10", "J", "Q", "K", "A"] as Rank[]) all.push({ rank, suit });
    s.collected = all.filter((c) => !s.hands.flat().some((h) => h.rank === c.rank && h.suit === c.suit));
    s.decided[0] = true;
    const r = applyAction(s, 0, { type: "claim", belot: true });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.belots[0]).toEqual(["hearts"]);
    expect(r.events.some((e) => e.type === "belot")).toBe(true);
  });

  it("counts a belot the other players still hold (belot on laid-down cards)", () => {
    const hands = [[k("J", "hearts"), k("9", "hearts"), k("A", "hearts")], [k("K", "hearts"), k("Q", "hearts"), k("7", "clubs")], [k("8", "clubs"), k("9", "clubs"), k("10", "clubs")], [k("J", "clubs"), k("Q", "clubs"), k("K", "clubs")]];
    const s = playing(hands, "hearts");
    s.tricksPlayed = 5;
    const all: Card[] = [];
    for (const suit of ["clubs", "diamonds", "hearts", "spades"] as Suit[]) for (const rank of ["7", "8", "9", "10", "J", "Q", "K", "A"] as Rank[]) all.push({ rank, suit });
    s.collected = all.filter((c) => !hands.flat().some((h) => h.rank === c.rank && h.suit === c.suit));
    s.decided[0] = true;
    const r = applyAction(s, 0, { type: "claim" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.belots[1]).toEqual(["hearts"]);
    expect(r.events.some((e) => e.type === "belot" && e.seat === 1)).toBe(true);
    expect(r.state.history.at(-1)!.announcements[1]).toBe(20);
  });
});

describe("a game cannot be won with a capo", () => {
  it("keeps playing when the round that passed 151 was a capo", () => {
    const s = playing([[k("J", "hearts"), k("9", "hearts")], [k("A", "spades")], [k("K", "spades")], [k("Q", "spades")]], "hearts");
    s.decided[0] = true;
    s.scores = [145, 100];
    s.tricksPlayed = 0;
    s.tricksWon = [0, 0];
    // everything but these four cards has been played, and seat 0 holds the trumps
    const all: Card[] = [];
    for (const suit of ["clubs", "diamonds", "hearts", "spades"] as Suit[]) for (const rank of ["7", "8", "9", "10", "J", "Q", "K", "A"] as Rank[]) all.push({ rank, suit });
    s.collected = all.filter((c) => !s.hands.flat().some((h) => h.rank === c.rank && h.suit === c.suit));
    const r = applyAction(s, 0, { type: "claim" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.scores[0]).toBeGreaterThanOrEqual(151);
    expect(r.state.phase).toBe("roundEnd");
    expect(r.state.winner).toBeNull();
  });
});
