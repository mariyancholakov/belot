import { cardEquals, isTrump, strength, type Card, type Contract } from "./cards";

/** A card played into the current trick, with the seat (0-3) that played it. */
export interface Play {
  seat: number;
  card: Card;
}

/**
 * Seat of the player currently winning the trick.
 * `plays[0]` is the lead. Higher trump wins; otherwise the highest card of the led suit.
 */
export function trickWinner(plays: readonly Play[], contract: Contract): number {
  const lead = plays[0];
  if (!lead) throw new Error("empty trick");

  let best = lead;
  for (const play of plays.slice(1)) {
    if (beats(play.card, best.card, lead.card, contract)) best = play;
  }
  return best.seat;
}

/** Does `challenger` beat `current`, given the trick was led with `led`? */
function beats(challenger: Card, current: Card, led: Card, contract: Contract): boolean {
  const challengerTrump = isTrump(challenger, contract);
  const currentTrump = isTrump(current, contract);

  if (challengerTrump && !currentTrump) return true;
  if (!challengerTrump && currentTrump) return false;
  // Same class: only the same suit can win (a discard never beats anything).
  if (challenger.suit !== current.suit) return false;
  if (challenger.suit !== led.suit && !challengerTrump) return false;
  return strength(challenger, contract) > strength(current, contract);
}

/**
 * Cards from `hand` that may legally be played into the trick.
 *
 * Bulgarian rules:
 * - must follow the led suit; in a trump suit (or all-trumps) you must also beat the
 *   best trump so far when you can ("overtrump")
 * - if you cannot follow: in a suit contract you must trump, unless your partner is
 *   currently winning the trick; over an opponent's trump you must overtrump, and when you
 *   cannot you may play anything (no under-trumping); in no-trumps you may play anything
 */
export function legalPlays(
  hand: readonly Card[],
  plays: readonly Play[],
  contract: Contract,
  seat: number,
): Card[] {
  const lead = plays[0];
  if (!lead) return [...hand];

  const followers = hand.filter((c) => c.suit === lead.card.suit);

  if (followers.length > 0) {
    // All-trumps, or the led suit is the trump suit: overtrump if possible.
    if (isTrump(lead.card, contract)) {
      const best = highestInSuit(plays, lead.card.suit, contract);
      const higher = followers.filter((c) => strength(c, contract) > strength(best, contract));
      return higher.length > 0 ? higher : followers;
    }
    return followers;
  }

  if (contract === "no-trumps" || contract === "all-trumps") return [...hand];

  // Cannot follow in a suit contract: partner winning => free choice.
  const winner = trickWinner(plays, contract);
  if (isPartner(seat, winner)) return [...hand];

  const trumps = hand.filter((c) => isTrump(c, contract));
  if (trumps.length === 0) return [...hand];

  // Must trump, and overtrump a trump already on the table if able; otherwise free choice.
  const tableTrumps = plays.filter((p) => isTrump(p.card, contract));
  if (tableTrumps.length === 0) return trumps;
  const best = tableTrumps.map((p) => p.card).reduce((a, b) => (strength(b, contract) > strength(a, contract) ? b : a));
  const higher = trumps.filter((c) => strength(c, contract) > strength(best, contract));
  return higher.length > 0 ? higher : [...hand];
}

export function isPartner(a: number, b: number): boolean {
  return a !== b && (a + 2) % 4 === b;
}

export function isLegal(
  card: Card,
  hand: readonly Card[],
  plays: readonly Play[],
  contract: Contract,
  seat: number,
): boolean {
  return legalPlays(hand, plays, contract, seat).some((c) => cardEquals(c, card));
}

function highestInSuit(plays: readonly Play[], suit: Card["suit"], contract: Contract): Card {
  return plays
    .map((p) => p.card)
    .filter((c) => c.suit === suit)
    .reduce((a, b) => (strength(b, contract) > strength(a, contract) ? b : a));
}
