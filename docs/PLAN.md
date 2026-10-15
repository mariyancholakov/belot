# Belot — execution plan

Web app to play Bulgarian belot with friends. Mobile-first, online rooms with a join code, 4 players in 2 teams (partners sit opposite). UI in Bulgarian.

Related docs: `docs/ARCHITECTURE.md` (system design), `docs/RULES.md` (rules spec), `CLAUDE.md` (working conventions).

## Decisions
| Topic | Decision |
|---|---|
| Platform | Web, mobile-first; same page on phones and laptops, no install |
| Multiplayer | Online rooms with a join code; bots later |
| Rules | Standard Bulgarian belot, target 151 (`docs/RULES.md`) |
| Language | UI in Bulgarian; code, docs and commits in English |
| Hosting | One Node process on Fly.io or Render; local Wi-Fi play works too |
| State | In memory now, SQLite later |
| Identity | No accounts: nickname + secret device token |
| Stack | pnpm monorepo, TypeScript, Vitest, `ws`, zod, Vite + React |

## How the work is done
- Each milestone below is a list of features. Every feature ends with tests passing, `pnpm typecheck` clean, one commit, and a push (see `CLAUDE.md`). No AI attribution in commits.
- Engine first: rules are the riskiest part, and everything else depends on them. UI and networking are mostly mechanical once the engine is right.
- Every milestone ends with a "done when" check that can be demonstrated, not just "code exists".
- Rule doubts are written into `docs/RULES.md` under "Assumptions" and the code keeps them in one place (constants or one function) so they are cheap to change.

## Status
- [x] M0 — Scaffold and specs
- [x] M1 — Rules engine
- [x] M2 — Protocol and server
- [x] M3 — Web client: playable game
- [~] M4 — Polish and Bulgarian UX (manifest, icons, landscape, browser smoke test done; sound, turn timer and card-flight animations later)
- [~] M5 — Deploy and play with friends (Dockerfile, CI, fly.toml, docs/DEPLOY.md ready; needs the owner to deploy)
- [ ] M6 — Bots
- [ ] M7 — History and stats (optional)

---

## M0 — Scaffold and specs ✅
- pnpm workspace, TypeScript base config, Vitest
- Private GitHub repo `mariyancholakov/belot`
- `docs/RULES.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`

## M1 — Rules engine (`packages/engine`)
Pure, deterministic, no I/O. Server and client both import it.

| # | Feature | Files | Status |
|---|---|---|---|
| 1.1 | Cards: suits, ranks, strength, points per contract | `cards.ts` | ✅ |
| 1.2 | Tricks: winner, legal plays (follow, trump, overtrump, partner rule) | `tricks.ts` | ✅ |
| 1.3 | Round scoring: rounding, inside, contra ×2/×4, capo, hanging, game winner | `scoring.ts` | ✅ |
| 1.4 | Seeded shuffle + deal (3+2, then 3 after bidding), dealer rotation, cut | `deal.ts` | ✅ |
| 1.5 | Bidding: bid order ♣<♦<♥<♠<no-trumps<all-trumps, pass, contra, re-contra, end conditions, all-pass redeal | `bidding.ts` | ✅ |
| 1.6 | Announcements: find sequences (terca/fifty/hundred) and carrés in a hand; compare teams (only the strongest team's sequences count, equal strongest cancel); carré cancels sequences; belot detection when K or Q of trump is played | `announcements.ts` | ✅ |
| 1.7 | Game state machine: one `GameState` type, `applyAction(state, seat, action)` returning new state + events or an error; phases `bidding → playing → roundEnd → gameOver` | `game.ts` | ✅ |
| 1.8 | Per-seat view: redact other hands, include `legalActions` | `view.ts` | ✅ |
| 1.9 | Random playout tests: thousands of seeded games with random legal moves; checks: game always ends, card points per round = 162 / 130 / 258, no illegal move is ever offered, score totals never decrease | `game.test.ts` | ✅ |

Rule details to verify while building 1.5–1.6 (record the answer in `docs/RULES.md`):
- Announcements in no-trumps: the common Bulgarian rule is that there are none. `RULES.md` currently assumes they count and are doubled; check and fix.
- Whether a higher bid is still allowed after a contra.
- When announcements are declared and shown (first trick) and the belot timing.

**Done when:** a full game to 151 can be played in a test using only `applyAction`, and the playout test passes for 10 000 seeded games.

## M2 — Protocol and server
### `packages/protocol`
| # | Feature |
|---|---|
| 2.1 | zod schemas for client messages: `createRoom`, `joinRoom`, `takeSeat`, `leaveSeat`, `startGame`, `action` (bid / play / announce), `ping` |
| 2.2 | Server messages: `roomState` (seats, nicknames, connected flags), `gameView` (per seat, with `seq`), `events`, `error` (codes, translated on the client) |

### `apps/server`
| # | Feature |
|---|---|
| 2.3 | HTTP + WebSocket server (`ws`), health endpoint, serves the built web app in production |
| 2.4 | Rooms: create with a 4-letter code (no confusable letters), join, seat selection, start when 4 seats are filled; empty rooms cleaned up after a timeout |
| 2.5 | Identity: client sends `{ token, nickname }`; token maps to a seat; reconnect restores the seat and sends the latest view |
| 2.6 | Game loop: validate message → `applyAction` → broadcast each seat its own view; seed from `crypto` per round |
| 2.7 | Disconnects: mark seat offline, pause the turn, show it to others; seat stays reserved |
| 2.8 | Integration tests with 4 fake socket clients playing a scripted game; a test that one client never receives another's hand |
| 2.9 | Basic protection: message size limit, rate limit per socket, reject actions out of turn |

**Done when:** four terminal test clients can create a room, join, play a full game to 151, and one can disconnect and reconnect mid-round.

## M3 — Web client: playable game (`apps/web`)
| # | Feature |
|---|---|
| 3.1 | Vite + React + TypeScript app, socket client with auto-reconnect, token in `localStorage` |
| 3.2 | Bulgarian strings in one file (`src/i18n/bg.ts`): suits, contracts, announcements, buttons, errors |
| 3.3 | Home: nickname, "Нова стая", "Влез със код"; room link `/<CODE>` joins directly |
| 3.4 | Lobby: 4 seats around a table, teams shown, share link button, start button |
| 3.5 | Table layout (phone portrait first): own hand at the bottom, partner on top, opponents left and right, trick in the middle |
| 3.6 | Bidding panel: only legal bids enabled, contra / re-contra, bidding history |
| 3.7 | Playing: tap a card to play; illegal cards dimmed using `legalActions` from the server |
| 3.8 | Announcements prompt during the first trick; belot prompt when playing K/Q of trump |
| 3.9 | Round summary (points per team, announcements, inside / capo / hanging) and running score sheet |
| 3.10 | Game over screen, "Нова игра" in the same room |

**Done when:** four browsers (two phones, two laptops on the same Wi-Fi) play a full game to 151 with no console errors.

## M4 — Polish and Bulgarian UX
| # | Feature |
|---|---|
| 4.1 | Card designs (SVG), readable on small phones; landscape and desktop layouts |
| 4.2 | Animations: dealing, playing a card, collecting a trick (driven by server events) |
| 4.3 | Turn indicator, optional turn timer, sound toggle |
| 4.4 | Connection states: "свързване…", player offline badges, paused game |
| 4.5 | "Add to Home Screen" support (web app manifest, icons, full screen) |
| 4.6 | Accessibility: tap targets, contrast, no info by color alone (suits have symbols) |
| 4.7 | Playwright smoke test: four browser contexts play one round end to end |

**Done when:** the group plays a test game and nothing about the UI needs explaining.

## M5 — Deploy and play with friends
| # | Feature |
|---|---|
| 5.1 | Production build: server serves `apps/web/dist`; Dockerfile |
| 5.2 | Deploy to Fly.io (or Render); HTTPS + WSS; env config |
| 5.3 | GitHub Actions: test + typecheck on every push; deploy on `main` |
| 5.4 | Logging of errors and room counts; restart-safe (rooms lost on restart is accepted for now) |
| 5.5 | Real game night; collect rule disagreements and bugs into issues |

**Done when:** friends in different places play a full game through the public link.

## M6 — Bots
| # | Feature |
|---|---|
| 6.1 | Bot interface: `view → action`, same path as a human through the server |
| 6.2 | Rule-based bot: sensible bidding from hand strength, follows legal play, basic card play (win cheap, give points to partner) |
| 6.3 | "Добави бот" in the lobby and bot takeover for a player who stays offline too long |
| 6.4 | Bot-vs-bot simulations as an extra engine stress test |

**Done when:** one person can play a full game with three bots, and a game continues when someone drops out.

## M7 — History and stats (optional)
- SQLite: finished games, round scores, per-nickname wins
- Room survives server restart (snapshot `GameState` as JSON)
- Simple stats page

## Risks and how they are handled
| Risk | Handling |
|---|---|
| Rule differences between groups | All doubts in `RULES.md`; rule constants in one place; later, room options for house rules |
| Announcement logic is the hardest rule area | Built as its own module with many table-driven tests before the state machine uses it |
| Phones sleeping / dropped connections | Snapshot-based protocol, token reconnect, seats held |
| Cheating via devtools | Server never sends other hands; every action validated on the server |
| Free hosting cold starts | Acceptable for friends; move to a small paid instance if annoying |

## Out of scope for now
Accounts, public matchmaking, chat, ranked play, native app store apps, real money.
