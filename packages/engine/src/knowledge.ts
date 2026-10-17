import { contractId, cardIndex, above, indices, maskOf, NO_TRUMPS, popcount, STRENGTH, SUIT_MASK, TRUMP, trickWinnerSim } from "./sim";
import type { GameView } from "./view";

/** What one seat can work out about the cards it cannot see, during play. */
export interface Knowledge {
  me: number;
  contract: number;
  /** Cards in the other hands. */
  unseen: number;
  /** Per seat: cards it is known to hold (shown announcements, a called belot's other half, the lucky card). */
  holds: number[];
  /** Per seat: cards it cannot hold, from how it followed suit and trumped. */
  cannot: number[];
  /** Cards each seat holds now. */
  counts: number[];
}

/**
 * Reads the round so far. A seat that does not follow suit has none of it; in a suit contract a
 * seat that neither follows nor trumps while the opponents win has no trumps, or none above an
 * opponent's trump already on the table; a seat that plays under the best trump on the table
 * when it had to beat it holds nothing higher.
 */
export function knowledgeOf(view: GameView): Knowledge {
  const c = contractId(view.contract!.contract);
  const me = view.seat;
  const mine = maskOf(view.hand);
  const played = maskOf(view.plays.map((p) => p.card));
  const unseen = ~(mine | played);
  const holds = [0, 0, 0, 0];
  const cannot = [0, 0, 0, 0];
  const t = TRUMP[c]!;
  const s = STRENGTH[c]!;

  for (let start = 0; start < view.plays.length; start += 4) {
    const trick = view.plays.slice(start, start + 4);
    const cards = trick.map((p) => cardIndex(p.card));
    const leader = trick[0]!.seat;
    const led = cards[0]! >> 3;
    for (let i = 1; i < trick.length; i++) {
      const seat = trick[i]!.seat;
      const card = cards[i]!;
      const before = cards.slice(0, i);
      if (card >> 3 === led) {
        // Following a trump lead: a seat must beat the best trump if it can.
        if (t[card]) {
          const best = Math.max(...before.filter((b) => b >> 3 === led).map((b) => s[b]!));
          if (s[card]! < best) cannot[seat]! |= above(c, led, best);
        }
        continue;
      }
      cannot[seat]! |= SUIT_MASK[led]!;
      if (c >= NO_TRUMPS) continue;
      if (trickWinnerSim(before, leader, c) === (seat + 2) % 4) continue;
      const tableTrumps = before.filter((b) => t[b]);
      if (tableTrumps.length === 0) {
        if (!t[card]) cannot[seat]! |= SUIT_MASK[c]!;
        continue;
      }
      // Over a trump it had to overtrump if it could; with nothing higher it may play anything.
      const best = Math.max(...tableTrumps.map((b) => s[b]!));
      if (!t[card] || s[card]! < best) cannot[seat]! |= above(c, c, best);
    }
  }

  const known = (seat: number, mask: number) => {
    if (seat !== me) holds[seat]! |= mask & unseen;
  };
  if (view.lucky) known(view.lucky.seat, maskOf([view.lucky.card]));
  for (const { seat, announcements } of view.announcements ?? []) for (const a of announcements) known(seat, maskOf(a.cards));
  view.belots.forEach((suits, seat) => {
    for (const suit of suits) {
      const si = ["clubs", "diamonds", "hearts", "spades"].indexOf(suit);
      known(seat, (1 << (si * 8 + 5)) | (1 << (si * 8 + 6)));
    }
  });
  // A card known to be in one hand is in no other.
  for (let seat = 0; seat < 4; seat++) for (let other = 0; other < 4; other++) if (other !== seat) cannot[other]! |= holds[seat]!;

  return { me, contract: c, unseen, holds, cannot, counts: [...view.handCounts] };
}

/**
 * Deals the unseen cards to the other seats at random, each getting as many as it holds and none
 * it cannot hold. Cards with the fewest possible owners go first; if the deal still gets stuck it
 * starts over, and after a few tries it lets the void readings go rather than fail.
 */
export function sampleHands(k: Knowledge, mine: number, rand: () => number): number[] {
  for (let attempt = 0; attempt < 30; attempt++) {
    const hands = deal(k, mine, rand, attempt < 25);
    if (hands) return hands;
  }
  throw new Error("cannot deal the unseen cards");
}

function deal(k: Knowledge, mine: number, rand: () => number, strict: boolean): number[] | null {
  const hands = k.holds.map((h, seat) => (seat === k.me ? mine : h));
  const need = k.counts.map((n, seat) => (seat === k.me ? 0 : n - popcount(hands[seat]!)));
  const free = k.unseen & ~(k.holds[0]! | k.holds[1]! | k.holds[2]! | k.holds[3]!);
  const cards = indices(free);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  const owners = (card: number) => {
    let n = 0;
    for (let seat = 0; seat < 4; seat++) if (seat !== k.me && !(strict && k.cannot[seat]! & (1 << card))) n++;
    return n;
  };
  cards.sort((a, b) => owners(a) - owners(b));
  for (const card of cards) {
    let total = 0;
    for (let seat = 0; seat < 4; seat++) if (need[seat]! > 0 && !(strict && k.cannot[seat]! & (1 << card))) total += need[seat]!;
    if (total === 0) return null;
    let pick = rand() * total;
    let owner = -1;
    for (let seat = 0; seat < 4; seat++) {
      if (need[seat]! <= 0 || (strict && k.cannot[seat]! & (1 << card))) continue;
      owner = seat;
      pick -= need[seat]!;
      if (pick < 0) break;
    }
    hands[owner]! |= 1 << card;
    need[owner]! -= 1;
  }
  return hands;
}
