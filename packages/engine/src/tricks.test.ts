import { describe, expect, it } from "vitest";
import type { Card } from "./cards";
import { legalPlays, trickWinner, type Play } from "./tricks";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });
const play = (seat: number, rank: Card["rank"], suit: Card["suit"]): Play => ({ seat, card: c(rank, suit) });

describe("trickWinner", () => {
  it("highest of the led suit wins when nobody trumps", () => {
    const plays = [play(0, "10", "clubs"), play(1, "A", "clubs"), play(2, "K", "clubs"), play(3, "A", "spades")];
    expect(trickWinner(plays, "hearts")).toBe(1);
  });

  it("any trump beats a plain card, higher trump beats lower", () => {
    const plays = [play(0, "A", "clubs"), play(1, "7", "hearts"), play(2, "9", "hearts"), play(3, "10", "clubs")];
    expect(trickWinner(plays, "hearts")).toBe(2);
  });

  it("a discard of another suit never wins", () => {
    const plays = [play(0, "7", "clubs"), play(1, "A", "spades"), play(2, "A", "diamonds"), play(3, "8", "clubs")];
    expect(trickWinner(plays, "hearts")).toBe(3);
  });

  it("in all-trumps only the led suit can win, J then 9 on top", () => {
    const plays = [play(0, "9", "spades"), play(1, "J", "hearts"), play(2, "J", "spades"), play(3, "A", "spades")];
    expect(trickWinner(plays, "all-trumps")).toBe(2);
  });

  it("no-trumps uses plain order", () => {
    const plays = [play(0, "J", "clubs"), play(1, "9", "clubs"), play(2, "10", "clubs"), play(3, "A", "hearts")];
    expect(trickWinner(plays, "no-trumps")).toBe(2);
  });
});

describe("legalPlays", () => {
  it("leader may play anything", () => {
    const hand = [c("7", "clubs"), c("A", "hearts")];
    expect(legalPlays(hand, [], "spades", 0)).toHaveLength(2);
  });

  it("must follow suit", () => {
    const hand = [c("7", "clubs"), c("A", "hearts"), c("K", "clubs")];
    const plays = [play(0, "10", "clubs")];
    expect(legalPlays(hand, plays, "spades", 1)).toEqual([c("7", "clubs"), c("K", "clubs")]);
  });

  it("must overtrump when the trump suit is led and you can", () => {
    const hand = [c("7", "hearts"), c("9", "hearts"), c("A", "clubs")];
    const plays = [play(0, "K", "hearts")];
    expect(legalPlays(hand, plays, "hearts", 1)).toEqual([c("9", "hearts")]);
  });

  it("may play any trump when none can overtrump", () => {
    const hand = [c("7", "hearts"), c("8", "hearts")];
    const plays = [play(0, "J", "hearts")];
    expect(legalPlays(hand, plays, "hearts", 1)).toHaveLength(2);
  });

  it("must trump when void, if the opponent is winning", () => {
    const hand = [c("7", "hearts"), c("A", "diamonds")];
    const plays = [play(0, "A", "clubs")];
    expect(legalPlays(hand, plays, "hearts", 1)).toEqual([c("7", "hearts")]);
  });

  it("may discard when void and partner is winning", () => {
    const hand = [c("7", "hearts"), c("A", "diamonds")];
    const plays = [play(0, "A", "clubs"), play(1, "7", "clubs")];
    // seat 2 is partner of seat 0, who is winning
    expect(legalPlays(hand, plays, "hearts", 2)).toHaveLength(2);
  });

  it("must overtrump an opponent's trump when void in the led suit", () => {
    const hand = [c("7", "hearts"), c("J", "hearts"), c("A", "diamonds")];
    const plays = [play(0, "A", "clubs"), play(1, "9", "hearts")];
    expect(legalPlays(hand, plays, "hearts", 2)).toEqual([c("J", "hearts")]);
  });

  it("any card when void in no-trumps", () => {
    const hand = [c("7", "hearts"), c("A", "diamonds")];
    expect(legalPlays(hand, [play(0, "A", "clubs")], "no-trumps", 1)).toHaveLength(2);
  });
});
