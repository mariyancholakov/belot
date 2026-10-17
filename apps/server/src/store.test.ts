import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { PostgresStore, tokenHash, type GameRecord } from "./store";

const record = (overrides: Partial<GameRecord>): GameRecord => ({
  roomCode: "ABCD",
  startedAt: new Date("2026-10-17T18:00:00Z"),
  seed: 123456789,
  players: [
    { seat: 0, nickname: "Ани", bot: false, token: tokenHash("token-ani-0123456789") },
    { seat: 1, nickname: "Бот 1", bot: true, token: null },
    { seat: 2, nickname: "Вили", bot: false, token: tokenHash("token-vili-0123456789") },
    { seat: 3, nickname: "Бот 2", bot: true, token: null },
  ],
  botLevel: "hard",
  scores: [152, 98],
  winner: 0,
  rounds: [
    {
      round: 1,
      contract: "hearts",
      bidder: 0,
      multiplier: 1,
      cardPoints: [100, 62],
      announcements: [0, 0],
      capo: null,
      result: { outcome: "made", recorded: [10, 6] } as never,
    },
  ],
  actions: [{ seat: 0, action: { type: "cut", position: 5 } }],
  version: "abc123",
  ...overrides,
});

async function open() {
  const pg = new PGlite();
  const store = await PostgresStore.open({ query: async (text, params) => (await pg.query<Record<string, unknown>>(text, params)).rows });
  return { pg, store };
}

describe("Postgres game store", () => {
  it("keeps finished games and gives each player only their own, newest first", async () => {
    const { pg, store } = await open();
    await store.save(record({}));
    await store.save(record({ scores: [40, 151], winner: 1, players: record({}).players.map((p) => (p.seat === 2 ? { ...p, token: tokenHash("token-other-0123456789") } : p)) }));

    const ani = await store.gamesOf(tokenHash("token-ani-0123456789"), 50);
    expect(ani.map((g) => g.scores)).toEqual([
      [40, 151],
      [152, 98],
    ]);
    expect(ani[0]!.seat).toBe(0);
    expect(ani[1]!.players.map((p) => p.nickname)).toEqual(["Ани", "Бот 1", "Вили", "Бот 2"]);
    expect(ani[1]!.rounds[0]!.contract).toBe("hearts");

    const vili = await store.gamesOf(tokenHash("token-vili-0123456789"), 50);
    expect(vili).toHaveLength(1);
    expect(vili[0]!.seat).toBe(2);

    expect(await store.gamesOf(tokenHash("nobody-0123456789abc"), 50)).toEqual([]);
    expect(await store.gamesOf(tokenHash("token-ani-0123456789"), 1)).toHaveLength(1);

    // The replay data is all there, and no player sees another's token.
    const [row] = (await pg.query<{ actions: unknown; seed: string; tokens: string[] }>("select actions, seed, tokens from games order by id limit 1")).rows;
    expect(row!.actions).toEqual([{ seat: 0, action: { type: "cut", position: 5 } }]);
    expect(Number(row!.seed)).toBe(123456789);
    expect(row!.tokens).toHaveLength(2);
    expect(JSON.stringify(ani)).not.toContain(tokenHash("token-vili-0123456789"));
  });

  it("opens an existing database again without losing games", async () => {
    const pg = new PGlite();
    const db = { query: async (text: string, params?: unknown[]) => (await pg.query<Record<string, unknown>>(text, params)).rows };
    await (await PostgresStore.open(db)).save(record({}));
    const again = await PostgresStore.open(db);
    expect(await again.gamesOf(tokenHash("token-ani-0123456789"), 50)).toHaveLength(1);
  });
});
