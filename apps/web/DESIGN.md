# Design

A standard, modern product look: clean surfaces, one green accent, a calm green felt table, white cards. Light and dark are both first-class. Derived from `src/styles.css`.

## Themes
Follows the system setting; a header button cycles Auto → Light → Dark and remembers the choice (`localStorage`, `belot.theme`). Tokens live on `:root`, overridden under `prefers-color-scheme: dark` and `[data-theme]`.

| Token | Light | Dark |
|---|---|---|
| `--bg` | #f2f3f5 | #0c0f13 |
| `--surface` | #ffffff | #161a20 |
| `--text` | #101318 | #eceff3 |
| `--muted` | #5f6876 | #98a1ae |
| `--line` | #e1e4e9 | #272d36 |
| `--accent` | #0e9f6e | #34d399 |
| `--danger` | #d3222f | #ff6b76 |
| felt | #2f8662 → #1f6046 | #1c4d3b → #12372a |
| card | #ffffff | #f1f3f6 |
| suit red | #d3222f | #d92c39 |

Teams: ours = teal avatar, theirs = amber avatar (also named "Ние / Вие" in the score).

## Type
Onest (Cyrillic-capable) at weights 400–800, tabular numerals everywhere numbers change. Headings 700, tight tracking (-0.02em). Card ranks 750.

## Shape and depth
Radii: controls 12–14px, panels 20–26px, cards 13% of width. Shadows have offset and blur (`--shadow-1`, `--shadow-2`); no hard offsets, no glow.

## Components
- Cards: rank + suit top-left, large suit bottom-right; dimmed when illegal, accent outline when playable.
- Bidding: suit grid (symbols, 52px targets), wide buttons for no-trumps, all-trumps, pass; contra/re-contra in danger red.
- Score: a table with contract, badges (Вътре, Капо, Контра), animated totals. Drawer from the bottom on phones, from the side on desktop.
- Round summary: centred modal over a blurred table.

## Motion
One system, all under `prefers-reduced-motion` (everything collapses to instant).
- Deal: cards fly in from the deck with 45ms stagger.
- Play: a card flies in from the direction of its seat; finished tricks rest 1.5s, then sweep to the winner.
- Turn: the active player's name pulses a ring; contract and bid bubbles pop.
- Scores count up; modals rise and fade.
Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (exponential ease-out).

## Sound
Synthesized with WebAudio (`src/sound.ts`), no audio files: card snap, deal riffle, trick sweep, your-turn chime, bid/pass/contra, belot sparkle, round win/lose. On by default at moderate volume; a header button mutes and remembers (`belot.sound`).
