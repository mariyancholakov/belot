# Deploying

Rooms live in memory in one process, so run exactly **one** instance. A restart (or an auto-stopped idle machine) drops running games.

## Play on the local network (no internet needed)
```
pnpm install
pnpm --filter @belot/web build
pnpm --filter @belot/server start      # serves the app and websockets on :3000
```
Friends on the same Wi-Fi (or your phone's hotspot) open `http://<your-laptop-ip>:3000`.

## Fly.io
```
brew install flyctl
fly auth login
fly launch --no-deploy --copy-config   # keep fly.toml; pick a unique app name
fly scale count 1
fly deploy
```
Notes:
- `auto_stop_machines = "stop"` shuts the machine down when idle (free-tier friendly). The first visit after a pause takes a few seconds; set `min_machines_running = 1` to keep a game alive across idle periods.
- HTTPS and WSS are handled by Fly; the client connects to `wss://<host>/ws` automatically.

## Render / Railway
Use the repo's `Dockerfile`. Set the port to `8080` (or set `PORT`). Single instance only.

## Checks
- `GET /health` returns `{"ok":true,"rooms":N}`.
- With the server running: `URL=http://localhost:3000 pnpm e2e` plays a round with four headless browsers (needs `npx playwright install chromium` once).
