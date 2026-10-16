---
name: Белотче
description: Bulgarian belot with friends, printed like a playing card.
colors:
  card-back-navy: "#22305e"
  card-back-navy-deep: "#1a2549"
  turn-navy-night: "#93a5ec"
  suit-red: "#c8202e"
  suit-red-night: "#f0676c"
  ink: "#141414"
  stock: "#fbfbf9"
  card-white: "#ffffff"
  stock-shade: "#f2f2ef"
  soft-ink: "#66665f"
  card-edge-line: "#e6e6e2"
  card-edge-strong: "#c9c9c2"
  pressed-stock: "#ecece8"
  their-grey: "#a3a39c"
  their-grey-ink: "#5f5f58"
  ledger-amber: "#8a5a00"
  night-ground: "#111111"
  night-surface: "#1b1b1b"
  night-surface-2: "#252525"
  night-ink: "#f2f2ef"
  night-card: "#f6f6f3"
typography:
  display:
    fontFamily: "Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.6rem"
    fontWeight: 750
    lineHeight: 1.1
    letterSpacing: "0.14em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  index:
    fontFamily: "Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  body:
    fontFamily: "Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  index: "9px"
  bid: "10px"
  control-sm: "12px"
  control: "14px"
  sheet: "20px"
  panel: "24px"
  pill: "99px"
  card: "13%"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "52px"
  button-primary-disabled:
    backgroundColor: "{colors.pressed-stock}"
    textColor: "{colors.soft-ink}"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "52px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.soft-ink}"
    rounded: "{rounded.control}"
    height: "52px"
  field:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "52px"
  bid:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.bid}"
    height: "52px"
  bid-pass:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.bid}"
    height: "52px"
  bid-contra:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.suit-red}"
    rounded: "{rounded.bid}"
  score-index:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    typography: "{typography.index}"
    rounded: "{rounded.index}"
    padding: "4px 8px 5px"
    width: "50px"
  card-face:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  card-back:
    backgroundColor: "{colors.card-back-navy}"
    rounded: "{rounded.card}"
  name-label-turn:
    backgroundColor: "{colors.card-back-navy}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.pill}"
  chip-contract:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
---

# Design System: Белотче

## Overview

**Creative North Star: "Картата"**

The whole interface is printed like a playing card. The page is white card stock, everything is drawn in black and red ink, corners carry a card's radius, and numbers sit where a card keeps its corner index. There is no table cloth: the table is the page itself, edge to edge, with nothing between the cards and the stock. This refuses the green-felt card-app default and casino gold.

Colour is rationed the way a printer rations ink. Black does the work: text, solid primary actions, selection, the winning-card outline. Red belongs to the red suits and to contra. One accent, the navy of a card back, appears on card backs and on whoever's turn it is, and nowhere else. Dark mode is the same deck in a dark room: a near-black ground, dark surfaces, white ink, and the playing cards themselves stay light.

Density is phone-first. Four players, a fanned hand, a centre heap and a bid board share one fixed screen that never scrolls; every touch target is large (44 to 52px) and white.

**Key Characteristics:**
- White stock ground, white card surfaces with a 1px light edge and a soft short shadow.
- Black ink for text and action; red ink only for hearts, diamonds and contra.
- One navy accent: card backs and the turn.
- One sans (Onest), tabular figures everywhere, ranks and score indices heavy (750 to 800).
- The score drawn as two corner-index tiles that turn over when points land.

## Colors

Black and red ink on white card stock, with the navy of a card back as the single accent.

### Primary
- **Card-Back Navy** (`card-back-navy`, with `card-back-navy-deep` as its stripe partner): the default card back (135deg stripes, 5px bands) and the turn: the ring around the active player's name or avatar and the fill of their name label on phones. Also the outline of the claim button. In dark mode the backs lift to a brighter navy pair (#2d3d78 / #22305e) so they read on the dark ground.
- **Turn Navy, Night** (`turn-navy-night`): the turn ring and turn label in dark mode only, with near-black ink on it. Card-back navy is unreadable on the #111 ground, so the turn changes value at night while the backs keep their navy.

### Secondary
- **Suit Red** (`suit-red`): hearts and diamonds on cards, on the bid board, in the trump badge, in bubbles and in the round sheet; contra and re-contra; the danger state (field errors, connection banner, a lost game title). On the light cards it stays this value in both modes.
- **Suit Red, Night** (`suit-red-night`): the danger/contra red on dark surfaces, where #c8202e would be too dark. Suit symbols printed on a light card keep `suit-red`.

### Neutral
- **Ink** (`ink`): all text, solid primary buttons, the Пас bar, the contract chip, the winning-card outline, toasts, focus outlines, text selection, and "our" team's avatar ring.
- **Card Stock** (`stock`): the page and table ground.
- **Card White** (`card-white`): every surface: cards, panels, bid buttons, score tiles, name pills, bubbles.
- **Stock Shade** (`stock-shade`): hover fill on icon buttons and menu items; the empty avatar disc.
- **Soft Ink** (`soft-ink`): secondary text, labels, ghost buttons, hints on the table.
- **Card Edge** (`card-edge-line`) and **Strong Edge** (`card-edge-strong`): 1px borders on surfaces; the strong edge on secondary buttons, inputs and empty seat slots (dashed).
- **Pressed Stock** (`pressed-stock`): disabled primary fill and the soft focus halo on inputs and your own seat slot.
- **Their Grey** (`their-grey`, with `their-grey-ink` for text): the other team. Teams are told apart by ink versus grey, not by hue.
- **Ledger Amber** (`ledger-amber`, #e0b456 at night): small round-sheet badges and rule flags only. It is a functional annotation colour, not part of the card's ink.
- **Night** (`night-ground`, `night-surface`, `night-surface-2`, `night-ink`, `night-card`): the dark-mode deck. Surfaces go dark, ink goes white, primary buttons invert to white with dark text, and cards stay light (`night-card`) with a darker edge.

### Named Rules
**The Two Inks Rule.** Text and actions are black; red is reserved for the red suits and contra/danger. A red that is not a heart, a diamond or a warning is a misprint.

**The One Navy Rule.** Navy marks card backs and the player whose turn it is. It is never used for buttons, links, headings or decoration; if two non-back things on a screen are navy, one of them is wrong.

**The Same Deck at Night Rule.** Dark mode swaps the room, not the deck: grounds and panels go dark, the cards stay light, and only colours that would vanish on #111 (the turn navy, the danger red) shift to their night values.

## Typography

**Display Font:** Onest (with system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Onest
**Label Font:** Onest

**Character:** one Cyrillic-capable workhorse sans across everything, at weights 400 to 800. Hierarchy comes from weight and size, not from a second family. Figures are tabular everywhere (set on the body), so changing scores never jitter.

### Hierarchy
- **Display** (750, 2.6rem rising to 3.8rem at 700px and 4.6rem at 1100px, line-height 1.1, tracking 0.14em): the room code in the lobby only.
- **Headline** (700, 1.5rem, tracking -0.02em): the round-summary title. All headings are 700 with -0.02em tracking and balanced wrapping.
- **Title** (700, 1rem to 1.15rem): drawer and panel headings (score sheet, bidding, prompts).
- **Index** (800, 1.45rem, line-height 1.05): team points in the score tiles; 2rem in the round sheet totals. Card ranks are 750 at 34% of the card width, with the suit at 27%.
- **Body** (400, 16px, line-height 1.45): running text, hints, prompts.
- **Label** (600 to 650, 0.72 to 0.85rem): team names over points, name pills, field labels, sheet headers, bid suit names.

### Named Rules
**The Corner Index Rule.** A number that matters is set like a card's corner index: heavy (750 to 800), tight (-0.02 to -0.03em), tabular, with its short label sitting directly above it.

## Layout

The table is one fixed screen (`100dvh`, no page scroll, no overscroll bounce): a top bar, the table area, the player's name and the fanned hand. On phones the table runs edge to edge with no frame; above 760px it centres at up to 1240px with 16px side margins and larger cards.

Card sizes are fluid tokens tied to viewport width: the hand (`clamp(54px, (100vw - 24px) / 4.5, 84px)`, narrowed on portrait phones so eight cards fit at 320px), the centre heap, top and side opponents. Opponents sit centred on their edges, the avatar laid over their fanned backs; side players hold their fans vertically. The player's name and hand overlap the bottom of the table by a computed lap. Landscape phones (height under 560px) get their own smaller card scale and a shorter bid board.

The score sits top left as two index tiles, the menu top right; on screens wider than 900px the menu becomes plain buttons in the bar. Home and lobby are a single centred white panel (400px, growing to 640px and 780px on wider screens) under a page bar with the logo.

Spacing is a loose 6 / 8 / 14 / 24px rhythm: 6 to 8px between related controls, 14px between groups and seat slots, 24px panel padding.

## Elevation & Depth

Depth is printed paper, not light. Surfaces are flat white sheets lifted by a short soft shadow; floating things (menus, drawers, the bid board, modals, bubbles) get a deeper diffuse one. Cards carry their own two-layer shadow so they read as physical stock on the page. There are no hard offsets and no glows; state is shown with rings (ink for the winner, navy for the turn), not with lift, except the hand card under the pointer, which rises 24px with a heavier shadow.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 2px rgba(20, 20, 20, 0.06)`): resting surfaces: buttons, fields, score tiles, name pills, the trump badge.
- **Lifted** (`box-shadow: 0 10px 28px rgba(20, 20, 20, 0.1)`): menus, drawers, the bid board, modals, bubbles, your own name pill.
- **Card** (`box-shadow: 0 1px 2px rgba(20, 20, 20, 0.08), 0 6px 16px rgba(20, 20, 20, 0.08)`): face-up cards.
- **Card Back** (`box-shadow: 0 1px 2px rgba(20, 20, 20, 0.16), 0 3px 8px rgba(20, 20, 20, 0.1)`): card backs, framed by a 3px white border.
- **Picked Up** (`box-shadow: 0 12px 20px rgba(0, 0, 0, 0.26)`): the playable hand card under the pointer.

### Named Rules
**The Rings Not Glows Rule.** State is a solid ring at the element's edge: 2px ink for the winning card or chosen back, 3px navy (pulsing out to 9px) for the turn. Nothing glows.

## Shapes

Everything is cut from card stock. Cards round at 13% of their width; score tiles at 9px; bid buttons at 10px; icon buttons and small controls at 12px; primary controls and fields at 14px; floating sheets at 20px; home, lobby and modal panels at 24px (28px on tablets). Name pills, chips and avatars are full pills or circles. Borders are 1px in the card-edge grey; empty seats use a 1.5px dashed strong edge. The one irregular shape is the speech bubble: a lopsided cloud (`46% 54% 50% 50% / 62% 58% 42% 38%`) trailing two small circles toward the speaker, as in a thought bubble.

## Components

### Buttons
Large, white or black, and quiet about it.
- **Shape:** gently rounded (14px), 52px tall, 24px side padding, weight 650.
- **Primary:** solid ink with white text and the sheet shadow; inverts to white with dark text in dark mode. Disabled goes to pressed stock with faded text.
- **Secondary:** white with a 1px strong edge; hover darkens the edge to soft ink. A 40px small size exists.
- **Ghost:** no fill, soft-ink text that turns to ink on hover.
- **Press:** every button scales to 0.98 on press with the house ease.
- **Icon buttons:** 40px (44px on the table and wide screens), 12px radius, transparent until hover.

### Fields
- **Style:** white, 1px strong edge, 14px radius, 52px tall, 16px padding, 1.05rem text.
- **Focus:** the edge turns ink with a 3px pressed-stock halo.
- **Error:** the edge turns red with an 18% red halo and a red message under the field. The room-code field is uppercase, centred, bold, tracked 0.4em.

### Chips
- **Style:** small pills (0.85rem, 600) on white with a 1px edge in the top bar; a quiet variant drops fill and border.
- **Contract:** the announced contract inverts to an ink chip, or a red-outlined white chip with red text for a red suit, and pops in.

### Bid Board
A white card of two columns: the four suits on the left (symbol at 1.7rem over its name), the other contracts on the right, and a full-width black Пас bar underneath. Bid buttons are white, 10px, 52px (46px in the table pop-up, shorter on phones); hover darkens the edge to ink; unavailable bids fade to 30%. Red suits print red; contra and re-contra are white with red text and a red-tinted edge.

### Cards
- **Face:** white stock, 1px edge, rank and suit stacked in the top-left corner, a large pip bottom right (hidden on overlapped hand cards so it never peeks out as a smudge). Red suits print in suit red.
- **Back:** one quiet ground with a fine pattern and a thin gold (#b8954a) frame inset 8%, inside a 3px white border. Four backs, picked by the host in the lobby: Синьо (navy, white hairline lattice, the default), Черно (black, gold dot grid), Слонова кост (ivory, ink hairline lattice), Графит (graphite, faint pinstripes). Gold appears only on card backs.
- **States:** illegal cards in your hand darken (brightness 0.55) on your turn; the card under the pointer rises 24px and straightens; the winning trick card gets a 2px ink ring; the lucky card a 2px ink ring with a flip-in.
- **Motion:** cards deal in from the deck, fly in from the thrower's side, rest in a loose heap leaning toward each thrower, then sweep to the winner.

### Score Index (signature)
Each team's points sit in a small white tile like the index in a card's corner: team name (Ние / Вие) at 0.68rem over points at 800 weight, centred, 9px radius, 1px edge, sheet shadow. Two tiles sit side by side at the top left of the table. When a team's points change the tile turns over (`rotateY` through 88deg and back over 0.5s with the house ease) while the number counts up; under reduced motion it does not turn. In the round summary the same team blocks print flat (no tile) at 2rem with a thin progress track toward 151.

### Seats and Turn
Opponents are an animal avatar (circle, ringed 2px in ink for our team or grey for theirs) over a small white name label. On their turn the active player gets a 3px navy ring that pulses; on portrait phones the ring sits on the avatar and the name label fills navy. A thin turn-clock bar runs down above the name, in ink at 70% opacity, turning red as time runs out. Your own name is a white pill with the lifted shadow over the top of your hand.

### Speech Bubbles
What a player says (a bid, belot, an announcement) appears as a white cloud with a 1px edge above their profile, pops in and fades away after 3 seconds. At the side edges bubbles grow inward to stay on screen.

### Trump Badge
A small white card-like badge in the top-left corner of the table showing the played suit symbol (red for hearts and diamonds) and its name.

### Navigation and Sheets
The score sheet is a drawer: from the bottom on phones (22px top radius, up to 80% height), from the right at 380px on wider screens. The round summary is a centred white modal (24px) over a blurred stock scrim. The game menu is a white pop-over list with 48px rows.

### Lobby
A white panel with the room code as the display line, share buttons, four seat slots in a 2x2 grid (partners sit on the diagonal and share a team tint), and a row of card-back swatches (38x54px, 6px radius, white border) the host picks from; the chosen swatch lifts 3px with an ink ring.

### Logo
A white card with a black hairline edge, its corner index a black "Б" over a small red heart and a larger heart pip below, tilted in front of a navy card back with the thin gold frame of the card backs. The favicon sets the same mark on an ink square (14px radius at 64px); the install icons inset it to 80%.

## Do's and Don'ts

### Do:
- **Do** keep every surface white stock with a 1px card-edge border and the sheet shadow; raise floating things with the lifted shadow only.
- **Do** print text and actions in ink (#141414), and use suit red (#c8202e) only for hearts, diamonds, contra and errors.
- **Do** reserve card-back navy (#22305e) for card backs and the turn, and switch the turn to #93a5ec with dark ink in dark mode.
- **Do** set every changing number in Onest with tabular figures, heavy (750 to 800) like a card index.
- **Do** keep touch targets at 44 to 52px and the table on one fixed, non-scrolling screen.
- **Do** keep cards light in dark mode; only the room goes dark.
- **Do** put every animation under the reduced-motion collapse, and use the house ease (`cubic-bezier(0.22, 1, 0.36, 1)`) for state changes.

### Don't:
- **Don't** bring back a felt or table-cloth colour behind the cards; the table is the page.
- **Don't** use navy for buttons, links, headings or emphasis.
- **Don't** use red for anything decorative; the logo's hearts are the heart suit, not an exception.
- **Don't** add casino gold, metallic trim or glows.
- **Don't** use hard offset shadows; depth is soft and short.
- **Don't** put small uppercase tracked labels above headings or values; the corner index is the label pattern.
