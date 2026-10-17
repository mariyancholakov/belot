import { describe, expect, it } from "vitest";
import type { Card } from "./cards";
import { findAnnouncements, findBelots, resolveAnnouncements } from "./announcements";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });
const filler: Card[] = [c("7", "clubs"), c("8", "diamonds"), c("9", "spades")];

describe("findAnnouncements", () => {
  it("finds terca, fifty and hundred by length", () => {
    expect(findAnnouncements([c("7", "hearts"), c("8", "hearts"), c("9", "hearts")], "hearts")[0]).toMatchObject({ kind: "terca", points: 20, high: "9" });
    expect(findAnnouncements([c("10", "hearts"), c("J", "hearts"), c("Q", "hearts"), c("K", "hearts")], "hearts")[0]).toMatchObject({ kind: "fifty", points: 50, high: "K" });
    const five = ["9", "10", "J", "Q", "K"].map((r) => c(r as Card["rank"], "spades"));
    expect(findAnnouncements(five, "hearts")[0]).toMatchObject({ kind: "hundred", points: 100 });
  });

  it("does not join cards that are not adjacent", () => {
    expect(findAnnouncements([c("7", "hearts"), c("8", "hearts"), c("10", "hearts"), c("J", "hearts")], "hearts")).toEqual([]);
  });

  it("values carrés: J 200, 9 150, A/10/K/Q 100, none for 7 or 8", () => {
    const four = (rank: Card["rank"]) => (["clubs", "diamonds", "hearts", "spades"] as const).map((s) => c(rank, s));
    expect(findAnnouncements(four("J"), "hearts")[0]!.points).toBe(200);
    expect(findAnnouncements(four("9"), "hearts")[0]!.points).toBe(150);
    expect(findAnnouncements(four("A"), "hearts")[0]!.points).toBe(100);
    expect(findAnnouncements(four("7"), "hearts")).toEqual([]);
  });

  it("none in no-trumps", () => {
    expect(findAnnouncements([c("7", "hearts"), c("8", "hearts"), c("9", "hearts")], "no-trumps")).toEqual([]);
  });

  it("a card counts once: the carré takes it and the sequence is read from the rest", () => {
    const hand = [c("K", "clubs"), c("K", "diamonds"), c("K", "hearts"), c("K", "spades"), c("Q", "hearts"), c("J", "hearts")];
    expect(findAnnouncements(hand, "hearts").map((a) => a.kind)).toEqual(["carre"]);
    const fifty = [c("A", "clubs"), c("A", "diamonds"), c("A", "hearts"), c("A", "spades"), c("J", "hearts"), c("Q", "hearts"), c("K", "hearts")];
    expect(findAnnouncements([...fifty, c("10", "hearts")], "hearts").map((a) => [a.kind, a.high])).toEqual([["carre", "A"], ["fifty", "K"]]);
  });
});

describe("findBelots", () => {
  const hand = [c("K", "hearts"), c("Q", "hearts"), c("K", "clubs"), c("Q", "clubs")];
  it("only the trump suit counts in a suit contract", () => {
    expect(findBelots(hand, "hearts")).toEqual(["hearts"]);
  });
  it("every suit counts in all-trumps", () => {
    expect(findBelots(hand, "all-trumps")).toEqual(["clubs", "hearts"]);
  });
  it("none in no-trumps", () => {
    expect(findBelots(hand, "no-trumps")).toEqual([]);
  });
});

describe("resolveAnnouncements", () => {
  const terca = [c("7", "hearts"), c("8", "hearts"), c("9", "hearts"), ...filler];
  const fifty = [c("10", "clubs"), c("J", "clubs"), c("Q", "clubs"), c("K", "clubs"), c("7", "spades")];
  const none = [c("7", "diamonds"), c("9", "clubs")];

  it("the team with the stronger best announcement scores all of its own", () => {
    const r = resolveAnnouncements([terca, fifty, none, none], "spades");
    expect(r.points).toEqual([0, 50]);
    expect(r.counted[0]).toEqual([]);
  });

  it("partners' announcements add up for the winning team", () => {
    const terca2 = [c("7", "spades"), c("8", "spades"), c("9", "spades")];
    const r = resolveAnnouncements([fifty, terca, terca2, none], "diamonds");
    expect(r.points).toEqual([50 + 20, 0]);
  });

  it("equal best announcements cancel each other", () => {
    const other = [c("7", "diamonds"), c("8", "diamonds"), c("9", "diamonds")];
    const r = resolveAnnouncements([terca, other, none, none], "clubs");
    expect(r.points).toEqual([0, 0]);
  });

  it("carrés of both teams count, and do not cancel the other team's sequences", () => {
    const four = (rank: Card["rank"]) => (["clubs", "diamonds", "hearts", "spades"] as const).map((s) => c(rank, s));
    const r = resolveAnnouncements([four("J"), [...four("A"), ...terca.slice(0, 3)], fifty, none], "spades");
    expect(r.points).toEqual([200 + 50, 100]);
    expect(r.counted[1]!.map((a) => a.kind)).toEqual(["carre"]);
  });

  it("belot counts even when the team loses the announcement comparison", () => {
    const belotHand = [c("K", "spades"), c("Q", "spades"), c("7", "clubs")];
    const r = resolveAnnouncements([belotHand, fifty, none, none], "spades");
    expect(r.points).toEqual([20, 50]);
  });
});
