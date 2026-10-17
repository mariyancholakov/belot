---
version: 1
slug: "src-styles-css"
primary_target: "src/styles.css"
related_targets: []
---

# Table and app shell (whole web app)

Scope: every screen of Белотче (home, lobby, table, bidding, score sheet, round summary). Mode: Operate.
Audience and job: friends at one table on their phones; seat four people fast and play rounds to 151.
Constraints kept: phone layout (2-column bid board, avatar over cards, bubbles above profiles), animal avatars, the logo mark, light and dark mode.

## Direction contract

THESIS: The interface is printed like a playing card: white stock, black and red ink, a card's corner radius and corner indices. It refuses the green-felt card-app default and the casino gold.

OWN-WORLD: stock #fbfbf9 ground, white #ffffff card surfaces with a 1px #e6e6e2 edge and a soft short shadow; ink #141414 for text, solid primary actions and selection; suit red #c8202e only for hearts and diamonds and contra; one accent, card-back navy #22305e, for card backs, your turn and your team. Dark mode is the same deck in a dark room: #111 ground, #1b1b1b surfaces, white ink. One workhorse sans (Onest), tabular figures, ranks at 800.

STORY: a player sees the cards and the score first, knows whose turn it is from one navy ring, and taps large white buttons.

FIRST VIEWPORT: white table edge to edge; score as two corner-index tiles (Ние / Вие) top left, menu top right; top opponent centred under them, side opponents centred on their edges, navy card backs fanned under each avatar; bid board centred as a white card of 2 columns with a black Пас bar; your name pill and fanned white hand at the bottom.

FORM: playing-card print system, rank 1 on my list (IMPECCABLE’S PICK), seed key e44d20d9. Signature move: the score drawn as card corner indices that flip when points land.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
