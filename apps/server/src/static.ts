import { createReadStream, existsSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** Serves the built web app; unknown paths fall back to index.html (room links like /ABCD). */
export function staticHandler(root: string) {
  const base = resolve(root);
  return (req: IncomingMessage, res: ServerResponse) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]!);
    let file = normalize(join(base, path));
    if (file !== base && !file.startsWith(base + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(base, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404);
      res.end("web app not built");
      return;
    }
    const ext = extname(file);
    const hashed = file.includes(`${sep}assets${sep}`);
    res.writeHead(200, {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
    });
    createReadStream(file).pipe(res);
  };
}
