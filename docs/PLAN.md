# Belot — plan

Web app to play Bulgarian belot with friends. Mobile-first, online rooms with a join code, 4 players in 2 teams (partners sit opposite).

## Decisions
- Platform: web, mobile-first (one link, no install)
- Multiplayer: online rooms with a join code; bots to fill seats are a later stage
- Rules: standard Bulgarian belot (trumps / no-trumps / all-trumps, announcements, contra / re-contra)

## Architecture
pnpm monorepo, TypeScript everywhere.

- `packages/engine` — pure, deterministic game rules. No I/O, no randomness inside (deck order is passed in). Fully unit-tested. Shared by server and client.
- `apps/server` — authoritative game server (Node + `ws`). Owns rooms and game state, validates every move with the engine, sends each player only their own hand.
- `apps/web` — Vite + React client. Renders the view the server sends; only offers legal moves (engine used client-side for highlighting, never trusted).

Why engine first: belot rules are the risky part (follow suit, trump, over-trump, announcements, scoring). Getting them right and tested makes the UI and networking mechanical.

## Stages
0. Repo scaffold, tooling, rules spec
1. Engine: cards, deck, deal, trick resolution, legal-move validation
2. Engine: bidding (incl. contra / re-contra), announcements, scoring, game to target
3. Server: rooms, join codes, seats, authoritative state, reconnect
4. Web: lobby, table, hand, trick area, bidding UI
5. Web: announcements, scoreboard, polish, animations
6. Deploy (single Node process serving the built web app + websocket)
7. Bots to fill empty seats; optional stats/history

## Open rule questions (confirm with the group before stage 2)
- Game target score (151 is common; some groups play 1001)
- Rounding of round scores, and the "hanging" points rule on ties
- "Inside" (вътре) rule when the bidding team fails
- Whether belot / announcements follow the exact order-of-precedence rules in the spec
- Last-trick bonus and capot (all tricks) bonus values

Stage 1 only needs the card/trick rules, so these do not block it.
