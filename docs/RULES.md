# Belot rules implemented

Sources: belot.bg (the rules page, English, checked 2026-10-15), Bulgarian Wikipedia, "Бридж-белот" (bg.wikipedia.org/wiki/Белот), cross-checked against the Sofia University FMI belot page where it was reachable. Target score: **151** (confirmed by the project owner).

## Table
4 players, 2 teams, partners opposite (seats 0+2 vs 1+3). 32 cards (7–A). The deck is shuffled once, at the start of a game. After that it is never reshuffled: after a round the played cards are gathered in the order they were played (trick by trick), and after an all-pass deal the same deck is reused. Before every deal the player to the dealer's left (the previous dealer after a redeal) cuts the deck: lifts the top packet, any size from 1 to 31 cards, and puts it under the rest. Only after three all-pass deals in a row may the next dealer choose to shuffle. The dealer may also ask for a "късметче" (lucky card): the first card dealt, to the player under hand, is turned face up and everybody knows it. The player under hand ("под ръка") is the one after the dealer who bids and leads first. Dealing is counter-clockwise: 3 cards, 2 cards, bidding, then 3 more. Bidding starts with the player after the dealer; the player to the right of the dealer leads the first trick.

## Bidding
Order, weakest to strongest: ♣ < ♦ < ♥ < ♠ < no-trumps < all-trumps. A player may bid higher, pass, contra or re-contra. Contra only against an opponent's bid, re-contra only against an opponent's contra. Bidding ends when everyone passes after the highest bid, or on re-contra. Everybody passing = redeal.

## Card points
| | 7 | 8 | 9 | 10 | J | Q | K | A |
|---|---|---|---|---|---|---|---|---|
| trump / all-trumps | 0 | 0 | 14 | 10 | 20 | 3 | 4 | 11 |
| plain / no-trumps | 0 | 0 | 0 | 10 | 2 | 3 | 4 | 11 |

Last trick +10. Totals: suit 162, no-trumps 130 (doubled to 260), all-trumps 258.

## Play
- Follow the led suit if you can. When the led suit is trumps (a suit contract's trump, or any suit in all-trumps) you must also beat the best card of that suit on the table if you can, even over your partner.
- Void in the led suit, suit contract: if your partner is winning the trick, play anything. Otherwise you must trump; if an opponent has already trumped you must overtrump. If you cannot overtrump, play anything: you never have to under-trump (belot.bg, Bulgarian Wikipedia, confirmed by the project owner). The usual play is then to throw your weakest card so the opponents take no points.
- Void in the led suit, no-trumps or all-trumps: play anything.

## Announcements
| | points |
|---|---|
| Belot (K+Q of trump; suit or all-trumps only) | 20 |
| Terca (3 in sequence) | 20 |
| Fifty (4 in sequence) | 50 |
| Hundred (5+ in sequence) | 100 |
| Carré 10 / Q / K / A | 100 |
| Carré 9 | 150 |
| Carré J | 200 |

Sequences (terca, fifty, hundred) are compared between the teams: only the team with the stronger best sequence scores its sequences, and if the best ones are equal neither does. Carrés are not compared: every declared carré counts, for both teams. A card counts in one announcement only; when it could be in a carré or a sequence, the one worth more is taken, which is always the carré (100 or more), and sequences are read from the cards left over. Belot is never cancelled and is called even when its K and Q are part of a sequence (confirmed by the project owner). No-trumps has no announcements at all, belot included (belot.bg, Bulgarian Wikipedia, confirmed by the project owner).

## Round score
Raw team total = card points + last trick + announcements; no-trumps raw is doubled. Converted to recorded points (÷10) with team-dependent rounding on the units digit:

| contract | team with fewer raw points rounds up from | team with more rounds up from |
|---|---|---|
| suit | 6 | 7 |
| all-trumps | 4 | 5 |
| no-trumps | 6 (both) | 6 |

- **Success**: bidding team has more raw points → each team records its own rounded points.
- **Inside (вътре)**: bidding team has fewer → all round points go to the opponents.
- **Tie**: the non-bidding team records its own raw points ÷ 10 rounded down; the bidder's points hang (висящи), ÷ 10 rounded up, and go to the winner of the next played round (belot.bg: "receive 15 and they hang 16"). If the next round also ties, the hanging points pile up.
- **Contra / re-contra**: the winner takes all round points ×2 / ×4, premiums included, the capo bonus too.
- **Capo (валат)**: the team that wins all 8 tricks gets +90 raw (recorded as 9, ×2 / ×4 with contra / re-contra). It is the one premium that is not doubled in no-trumps. **A game cannot be won with a capo**: if the round that took a team to 151 was a capo, the game goes on and a later round without a capo decides it (belot.bg: "If a game ends with a valat, then another dealing must be played until a game is won without a valat").

## Game
First team to reach 151 wins; if both pass 151 the higher total wins; a tie is played on.

## Assumptions to confirm with the group
- Capo bonus recorded as 9 (90 raw ÷ 10), on top of the normal round score. belot.bg says "90 points" without saying whether that is 9 or 90 in the 151 scale; we assume 9, as the other premiums are also divided by 10.
- Bidding: after a contra no higher bids are allowed (only pass or re-contra); the three other players each get one turn after a contra, and re-contra ends bidding at once. The source does not say whether bidding can continue after a contra.
- Announcements are declared by the player. Before a seat's first card of the round, if its hand holds any, it is asked whether to declare them; what it does not declare scores nothing. Only the first trick can carry announcements (belot excepted). The team with the stronger best declared sequence (points, then top card) scores all its declared sequences; if the best ones are equal, neither team scores sequences. Declared carrés always count. Belot (K+Q of trump; in all-trumps, of any suit) is called by the player when playing the first of the pair, or when laying cards down, and then counts 20; a belot not called is lost.
- Laying the cards down ("сваляне"): a player who leads may lay their hand down (with at least two cards left) when every card in it is certain to win (no unseen card beats it; a plain-suit card only counts while no trump is unseen). The team takes every remaining card plus the last-trick bonus, and the round ends at once. Belot on laid-down cards (белот на свалени карти): any other player still holding both K and Q of a belot suit calls it, and it counts 20 for them; the game calls it for them automatically, as nobody would keep quiet (confirmed by the project owner).
