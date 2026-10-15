# Architecture

## Principle
The server is authoritative. Clients send intents; the server validates them with the engine and sends back each player's own view. The engine is a pure function: `applyAction(state, seat, action) -> { state, events } | error`.

## Packages
```
packages/engine    rules: state machine, legal moves, scoring. No I/O, no randomness.
packages/protocol  shared message types + zod validation (client <-> server contract)
apps/server        rooms, websockets, timers, reconnect; calls the engine
apps/web           React UI (Bulgarian); renders views, never decides rules
```

## Game state machine
`lobby -> bidding -> playing -> round score -> next round | game over (151)`.
Every action is valid only in the right phase and for the seat whose turn it is. Announcements are declared during the first trick and validated by the engine.

Shuffling: the server picks a seed and passes it in; the engine deals from it. Games are replayable and bugs reproducible.

## Network
- WebSocket, JSON messages, validated with zod on both ends.
- Client -> server: intents (`joinRoom`, `takeSeat`, `bid`, `playCard`, `announce`, ...).
- Server -> client: a redacted snapshot per seat (own hand, other players' card counts, table, scores, `legalMoves`) plus a short list of events for animations. Every snapshot has a sequence number.
- Snapshots instead of diffs: reconnecting just means sending the latest snapshot. Other players' hands never leave the server.

## Rooms and identity
- Rooms live in memory in one Node process, addressed by a 4-5 letter code.
- No accounts. The client keeps a random secret token (localStorage) and a nickname; reconnecting with the token restores the seat.
- A disconnected player's seat is held; the game pauses with a timeout.
- Bots implement the same interface as a human (`view -> action`), so they can be added without changing the server.

## Persistence
In-memory for now. SQLite later for match history and stats; the engine state is plain JSON, so snapshotting a room is trivial.

## Hosting
One Node process serves the built web app and the websocket endpoint, deployed to Fly.io or Render.

## Testing
- Engine: unit tests, plus random full-game playouts (always terminates, points sum correctly, no illegal move offered).
- Server: integration tests with fake socket clients.
- Web: Playwright smoke test of a full 4-player game, later.
