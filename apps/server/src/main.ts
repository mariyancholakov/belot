import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { startServer } from "./server";
import { staticHandler } from "./static";

const port = Number(process.env.PORT ?? 3000);
const webDist = process.env.WEB_DIST ?? fileURLToPath(new URL("../../web/dist", import.meta.url));

const server = await startServer({
  port,
  onRequest: existsSync(webDist) ? staticHandler(webDist) : undefined,
});
console.log(`belot server listening on :${server.port}${existsSync(webDist) ? ` (serving ${webDist})` : " (no web build found)"}`);
