# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
A small, fixed group of friends in Bulgaria who already play belot (Bulgarian bridge-belote) together. Four people at a time, two teams of two, partners sitting opposite. The group mostly plays **together in one room**, each person on their own phone, with phones in hand or resting on the table, and occasionally remotely. Some players may be older or less comfortable with technology. The job: sit down, get four people seated fast, and play rounds to 151 without fighting the app or arguing about the score.

## Product Purpose
A private online belot table for friends. One person opens a table and shares a 4-letter code or link; everyone joins from their phone or laptop browser with no install and no account. The server runs the rules (bidding, contra/re-contra, announcements, scoring, 151 target) so nobody has to count points or dispute a legal move. Success: a card night where the app disappears and the game is the point.

## Positioning
Private and ad-free: no accounts, no strangers, no ranking, no ads. It is a table owned by one friend group, running that group's house rules, not a public platform. A public belot app cannot truthfully offer that.

## Operating Context
- Mostly one physical room: several phones in the same space at once, so audio from each device overlaps and screens can be seen by neighbours.
- Phone in portrait is the primary device; laptops and landscape phones also supported.
- Sessions are several rounds long and may last an evening; the score is traditionally kept on paper in Bulgarian belot ("Ние / Вие").
- Players are seated opposite their partner; play runs counter-clockwise.
- Vocabulary is Bulgarian card-table language: купа, каро, пика, спатия, без коз, всичко коз, контра, реконтра, терца, петдесет, сто, каре, белот, вътре, капо, висящи.

## Capabilities and Constraints
- Implemented: rooms by code, seats, full Bulgarian belot rules engine, per-player views (others' cards never reach the client), reconnect to the same seat, round and game summaries, paper-style score sheet, installable to the home screen.
- Server is authoritative; one process, state in memory (a restart ends running games).
- UI is Bulgarian only; code, docs and commits are English.
- Rule details still to confirm with the group are listed in `docs/RULES.md` (capo value, no-trump announcements, tie rounding).
- Not built yet: sound, bots, history/stats, turn timer.

## Brand Commitments
- The name is **Белот** and the interface stays Bulgarian-only.
- No analytics, no tracking, no ads, no data beyond a nickname and a device token.
- Sound is always optional, with a mute control that remembers the choice.

## Evidence on Hand
- A working implementation in `apps/web/src` (home, lobby, table, bidding, score sheet) with a deliberately dark ink-blue and brass look; it is the incumbent, not an approved direction.
- Rules spec: `docs/RULES.md`; architecture: `docs/ARCHITECTURE.md`.
- No logo, user testimonials, usage data or photography exist. None should be invented.

## Product Principles
1. The game is the interface: cards, table and score come first; chrome stays out of the way.
2. The app keeps score and enforces rules so friends argue about play, not arithmetic.
3. Built for a shared room: nothing should embarrass a player with a loud device or expose their hand to the person beside them.
4. A table that feels like theirs: warm, personal, unhurried, never a casino or a generic card-game template.
5. Anyone at the table, including the least technical, can join and play without help.

## Accessibility & Inclusion
Large, forgiving tap targets and readable text for older players. Suits are never distinguished by colour alone (symbol plus colour). Respect reduced-motion preferences. Sound is optional and never the only carrier of information.
