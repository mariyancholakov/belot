import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { startServer } from "./server";
import { PostgresStore } from "./store";
import { staticHandler } from "./static";

const port = Number(process.env.PORT ?? 3000);
const webDist = process.env.WEB_DIST ?? fileURLToPath(new URL("../../web/dist", import.meta.url));

const dataFile = process.env.BELOT_DATA ?? fileURLToPath(new URL("../data/rooms.json", import.meta.url));

// Finished games go to Postgres (Supabase's session pooler) when DATABASE_URL is set, else stay in memory.
const databaseUrl = process.env.DATABASE_URL;
let store: PostgresStore | undefined;
if (databaseUrl) {
  const sql = postgres(databaseUrl, { max: 3, idle_timeout: 60, onnotice: () => {} });
  store = await PostgresStore.open({ query: (text, params) => sql.unsafe(text, (params ?? []) as never[]) as Promise<Record<string, unknown>[]> });
  console.log("recording finished games in the database");
} else console.log("no DATABASE_URL: finished games are kept in memory only");

const server = await startServer({
  port,
  dataFile,
  store,
  version: process.env.RENDER_GIT_COMMIT ?? null,
  onRequest: existsSync(webDist) ? staticHandler(webDist) : undefined,
});
console.log(`belot server listening on :${server.port}${existsSync(webDist) ? ` (serving ${webDist})` : " (no web build found)"}`);
