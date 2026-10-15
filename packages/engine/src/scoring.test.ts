import { describe, expect, it } from "vitest";
import { gameWinner, scoreRound, toRecorded, type RoundInput } from "./scoring";

const base: RoundInput = {
  contract: "hearts",
  bidder: 0,
  multiplier: 1,
  cardPoints: [100, 62],
  announcements: [0, 0],
  capo: null,
  hanging: 0,
};

describe("toRecorded", () => {
  it("suit: fewer rounds up from 6, more from 7", () => {
    expect(toRecorded(66, "hearts", false)).toBe(7);
    expect(toRecorded(65, "hearts", false)).toBe(6);
    expect(toRecorded(96, "hearts", true)).toBe(9);
    expect(toRecorded(97, "hearts", true)).toBe(10);
  });

  it("all-trumps: fewer rounds up from 4, more from 5", () => {
    expect(toRecorded(134, "all-trumps", false)).toBe(14);
    expect(toRecorded(134, "all-trumps", true)).toBe(13);
    expect(toRecorded(125, "all-trumps", true)).toBe(13);
  });

  it("no-trumps: rounds up above 5", () => {
    expect(toRecorded(126, "no-trumps", true)).toBe(13);
    expect(toRecorded(124, "no-trumps", false)).toBe(12);
  });
});

describe("scoreRound", () => {
  it("a plain suit round adds up to 16", () => {
    for (const [a, b] of [[100, 62], [92, 70], [87, 75], [84, 78]] as const) {
      const r = scoreRound({ ...base, cardPoints: [a, b] });
      expect(r.recorded[0] + r.recorded[1]).toBe(16);
    }
  });

  it("all-trumps round adds up to 26", () => {
    const r = scoreRound({ ...base, contract: "all-trumps", cardPoints: [134, 124] });
    expect(r.recorded[0] + r.recorded[1]).toBe(26);
  });

  it("no-trumps doubles the raw points", () => {
    const r = scoreRound({ ...base, contract: "no-trumps", cardPoints: [80, 50] });
    expect(r.recorded).toEqual([16, 10]);
  });

  it("bidder who falls short is inside: opponents take everything", () => {
    const r = scoreRound({ ...base, cardPoints: [62, 100] });
    expect(r.outcome).toBe("inside");
    expect(r.recorded).toEqual([0, 16]);
  });

  it("contra doubles the winner's take; failed contra doubles for the opponents", () => {
    const won = scoreRound({ ...base, multiplier: 2 });
    expect(won.recorded).toEqual([32, 0]);
    const lost = scoreRound({ ...base, multiplier: 2, cardPoints: [62, 100] });
    expect(lost.recorded).toEqual([0, 32]);
  });

  it("re-contra quadruples", () => {
    expect(scoreRound({ ...base, multiplier: 4 }).recorded).toEqual([64, 0]);
  });

  it("announcements count toward the comparison", () => {
    const r = scoreRound({ ...base, cardPoints: [60, 102], announcements: [50, 0] });
    expect(r.outcome).toBe("success");
  });

  it("a tie: non-bidder records, bidder's points hang", () => {
    const r = scoreRound({ ...base, cardPoints: [81, 81] });
    expect(r.outcome).toBe("tie");
    expect(r.recorded).toEqual([0, 8]);
    expect(r.hanging).toBe(8);
  });

  it("hanging points go to the winner of the next played round", () => {
    const r = scoreRound({ ...base, hanging: 8 });
    expect(r.recorded[0]).toBe(10 + 8);
    expect(r.hanging).toBe(0);
  });

  it("hanging points keep hanging through another tie", () => {
    const r = scoreRound({ ...base, cardPoints: [81, 81], hanging: 8 });
    expect(r.hanging).toBe(16);
  });

  it("capo bonus is added and not multiplied", () => {
    const r = scoreRound({ ...base, multiplier: 2, cardPoints: [162, 0], capo: 0 });
    expect(r.recorded).toEqual([(16 * 2) + 9, 0]);
  });
});

describe("gameWinner", () => {
  it("continues below 151", () => {
    expect(gameWinner([150, 120])).toBeNull();
  });
  it("first to 151 wins", () => {
    expect(gameWinner([151, 120])).toBe(0);
  });
  it("higher total wins if both pass", () => {
    expect(gameWinner([160, 155])).toBe(0);
    expect(gameWinner([152, 158])).toBe(1);
  });
  it("tie continues", () => {
    expect(gameWinner([155, 155])).toBeNull();
  });
});
