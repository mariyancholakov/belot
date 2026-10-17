import { createHash } from "node:crypto";
import type { GameAction, RoundSummary } from "@belot/engine";
import type { BotLevel, HistoryGame } from "@belot/protocol";

/**
 * Finished games, kept for the players' history and as training data for the bots. A record
 * holds the seed and every action, so the whole game (every hand, bid and card) can be replayed
 * with the engine it was played under (`version`).
 */
export interface GameRecord {
  roomCode: string;
  startedAt: Date;
  seed: number;
  /** By seat; `token` is the `tokenHash` of a person, null for a bot. */
  players: { seat: number; nickname: string; bot: boolean; token: string | null }[];
  botLevel: BotLevel | null;
  scores: [number, number];
  winner: 0 | 1;
  rounds: RoundSummary[];
  actions: { seat: number; action: GameAction }[];
  /** The deployed commit, when known. */
  version: string | null;
}

export interface GameStore {
  save(record: GameRecord): Promise<void>;
  /** The latest finished games the person with this token hash played in, newest first. */
  gamesOf(tokenHash: string, limit: number): Promise<HistoryGame[]>;
}

/** Device tokens are secrets (they hold a seat); only their hashes are stored. */
export const tokenHash = (token: string): string => createHash("sha256").update(token).digest("hex");

const tokensOf = (r: GameRecord): string[] => r.players.flatMap((p) => (p.token ? [p.token] : []));

/** What the person with token hash `hash` sees of a game: no tokens, no actions. */
const summaryOf = (r: GameRecord, id: string, finishedAt: Date, hash: string): HistoryGame => ({
  id,
  finishedAt: finishedAt.toISOString(),
  players: r.players.map((p) => ({ nickname: p.nickname, bot: p.bot })),
  seat: r.players.find((p) => p.token === hash)?.seat ?? 0,
  scores: r.scores,
  winner: r.winner,
  rounds: r.rounds,
});

/** Kept in memory: used when no database is configured, and in tests. */
export class MemoryStore implements GameStore {
  readonly records: { id: string; finishedAt: Date; record: GameRecord }[] = [];

  async save(record: GameRecord): Promise<void> {
    this.records.push({ id: String(this.records.length + 1), finishedAt: new Date(), record });
  }

  async gamesOf(hash: string, limit: number): Promise<HistoryGame[]> {
    return this.records
      .filter((g) => tokensOf(g.record).includes(hash))
      .reverse()
      .slice(0, limit)
      .map((g) => summaryOf(g.record, g.id, g.finishedAt, hash));
  }
}

/** The one call the Postgres store needs, so the same SQL runs on Supabase and on PGlite in tests. */
export interface Db {
  query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

/**
 * Only the server reads and writes these tables, over its own connection. Row level security is
 * on with no policies, so the Supabase Data API cannot reach them even if the table is exposed.
 */
const SCHEMA = `
create table if not exists games (
  id bigint generated always as identity primary key,
  finished_at timestamptz not null default now(),
  started_at timestamptz not null,
  room_code text not null,
  seed bigint not null,
  players jsonb not null,
  tokens text[] not null,
  bot_level text,
  scores int[] not null,
  winner smallint not null,
  rounds jsonb not null,
  actions jsonb not null,
  version text
);
create index if not exists games_tokens on games using gin (tokens);
alter table games enable row level security;
`;

export class PostgresStore implements GameStore {
  private constructor(private readonly db: Db) {}

  /** Connects and makes sure the tables exist. */
  static async open(db: Db): Promise<PostgresStore> {
    for (const statement of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await db.query(statement);
    return new PostgresStore(db);
  }

  // JSON goes in as text and is cast in SQL: drivers JSON-encode values bound to jsonb, which would store a string.
  async save(r: GameRecord): Promise<void> {
    await this.db.query(
      `insert into games (started_at, room_code, seed, players, tokens, bot_level, scores, winner, rounds, actions, version)
       values ($1::timestamptz, $2, $3, $4::text::jsonb, $5::text[], $6, $7::int[], $8, $9::text::jsonb, $10::text::jsonb, $11)`,
      [r.startedAt.toISOString(), r.roomCode, r.seed, JSON.stringify(r.players), tokensOf(r), r.botLevel, r.scores, r.winner, JSON.stringify(r.rounds), JSON.stringify(r.actions), r.version],
    );
  }

  async gamesOf(hash: string, limit: number): Promise<HistoryGame[]> {
    const rows = await this.db.query(
      `select id, finished_at, started_at, room_code, seed, players, bot_level, scores, winner, rounds, version
       from games where tokens @> array[$1]::text[] order by finished_at desc, id desc limit $2`,
      [hash, limit],
    );
    return rows.map((row) => {
      const record: GameRecord = {
        roomCode: row.room_code as string,
        startedAt: new Date(row.started_at as string),
        seed: Number(row.seed),
        players: json(row.players),
        botLevel: (row.bot_level as BotLevel | null) ?? null,
        scores: (row.scores as number[]).map(Number) as [number, number],
        winner: Number(row.winner) as 0 | 1,
        rounds: json(row.rounds),
        actions: [],
        version: (row.version as string | null) ?? null,
      };
      return summaryOf(record, String(row.id), new Date(row.finished_at as string), hash);
    });
  }
}

/** jsonb comes back parsed from some drivers and as text from others. */
const json = <T>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : v) as T;
