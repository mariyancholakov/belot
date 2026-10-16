import { describe, expect, it } from "vitest";
import { applyAction, legalActions, newGame, type GameState } from "./game";
import type { Play } from "./tricks";
import { viewFor } from "./view";

function toPlaying(): GameState {
  let s = newGame(5);
  const cut = applyAction(s, 3, { type: "cut", position: 12 });
  if (!cut.ok) throw new Error(cut.error);
  const deal = applyAction(cut.state, 0, { type: "deal", lucky: false });
  if (!deal.ok) throw new Error(deal.error);
  s = deal.state;
  for (const [seat, bid] of [
    [1, { type: "bid", contract: "hearts" }],
    [2, { type: "pass" }],
    [3, { type: "pass" }],
    [0, { type: "pass" }],
  ] as const) {
    const r = applyAction(s, seat, { type: "bid", bid });
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

describe("viewFor", () => {
  it("shows only the viewer's own cards", () => {
    const s = toPlaying();
    const v = viewFor(s, 2);
    expect(v.hand).toEqual(s.hands[2]);
    expect(v.handCounts).toEqual([8, 8, 8, 8]);
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(s.hands[0]));
  });

  it("lists legal actions only for the player on turn", () => {
    const s = toPlaying();
    expect(viewFor(s, 1).legalActions.length).toBeGreaterThan(0);
    expect(viewFor(s, 2).legalActions).toEqual([]);
  });

  it("hides announcements until the first trick is complete", () => {
    const s = toPlaying();
    expect(viewFor(s, 0).announcements).toBeNull();
  });

  it("records the bid log", () => {
    const s = toPlaying();
    expect(viewFor(s, 0).bidLog).toHaveLength(4);
    expect(viewFor(s, 0).contract?.contract).toBe("hearts");
  });

  it("lists every card played this round with who played it", () => {
    let s = toPlaying();
    expect(viewFor(s, 0).plays).toEqual([]);
    const seen: Play[] = [];
    while (seen.length < 22) {
      const seat = s.turn;
      const options = legalActions(s, seat);
      const action = options.find((a) => a.type === "announce") ?? options.find((a) => a.type === "play")!;
      const r = applyAction(s, seat, action);
      if (!r.ok) throw new Error(r.error);
      for (const e of r.events) if (e.type === "played") seen.push({ seat: e.seat, card: e.card });
      s = r.state;
      expect(viewFor(s, (seat + 1) % 4).plays).toEqual(seen);
    }
  });
});
