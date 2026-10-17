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

## Render (free, no card)
1. Sign in at render.com with GitHub and allow access to the `belot` repo.
2. New → Blueprint → pick the repo. `render.yaml` sets up one free Docker web service with `/health` as its health check.
3. Open the `onrender.com` link it gives you.

The free tier sleeps after ~15 minutes without traffic (a sleeping service drops open games, and waking takes about a minute). To keep it awake during a session, add a free monitor at uptimerobot.com that requests `https://<your-app>.onrender.com/health` every 5 minutes. Free hours (750 a month) cover one service running all month.

### Game history (Supabase)
Finished games are recorded in Postgres for the players' history and as training data for the bots. Without `DATABASE_URL` they are kept in memory and lost on restart.
1. In the Supabase project: **Connect** → **Session pooler** (IPv4, which Render needs; the direct connection is IPv6 only). Copy the string `postgresql://postgres.<project-ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres` and put the database password in it (percent-encode `#`, `&`, `?`, spaces).
2. In Render: the service → **Environment** → add `DATABASE_URL` with that string → save (it redeploys).
3. The log then says `recording finished games in the database`. The server creates the `games` table on start; row level security is on with no policies, so only the server's own connection can read it.

## Railway
Use the repo's `Dockerfile`. Single instance only.

## Checks
- `GET /health` returns `{"ok":true,"rooms":N}`.
- With the server running: `URL=http://localhost:3000 pnpm e2e` plays a round with four headless browsers (needs `npx playwright install chromium` once).
