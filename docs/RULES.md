# Belot rules implemented

Source: Bulgarian Wikipedia, "Бридж-белот" (bg.wikipedia.org/wiki/Белот), cross-checked against the Sofia University FMI belot page where it was reachable. Target score: **151** (confirmed by the project owner).

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

Only the strongest combinations count; a carré cancels terca/fifty/hundred; belot is never cancelled.

## Round score
Raw team total = card points + last trick + announcements; no-trumps raw is doubled. Converted to recorded points (÷10) with team-dependent rounding on the units digit:

| contract | team with fewer raw points rounds up from | team with more rounds up from |
|---|---|---|
| suit | 6 | 7 |
| all-trumps | 4 | 5 |
| no-trumps | 6 (both) | 6 |

- **Success**: bidding team has more raw points → each team records its own rounded points.
- **Inside (вътре)**: bidding team has fewer → all round points go to the opponents.
- **Tie**: the non-bidding team records its own points; the bidder's points hang (висящи) and go to the winner of the next played round.
- **Contra / re-contra**: the winner takes all round points ×2 / ×4. Capo bonus is not multiplied.
- **Capo (валат)**: the team that wins all 8 tricks gets +90 raw (recorded as 9).

## Game
First team to reach 151 wins; if both pass 151 the higher total wins; a tie is played on.

## Assumptions to confirm with the group
- Capo bonus recorded as 9 (90 raw ÷ 10), on top of the normal round score. The source says "90 points"; whether that is 9 or 90 in the 151-scale is not stated.
- Announcements are doubled in no-trumps together with the rest of the raw points.
- On a tie, both teams are rounded with the "fewer points" rule.
- The source also mentions a "151–159 after capo" extra round; the wording is unclear, not implemented.
- Bidding: after a contra no higher bids are allowed (only pass or re-contra); the three other players each get one turn after a contra, and re-contra ends bidding at once. The source does not say whether bidding can continue after a contra.
- Announcements are detected automatically from the dealt hand (players cannot hide or misdeclare them). The team with the stronger best announcement (points, then top card) scores all of its announcements; if the best ones are equal, neither team scores announcements. A carré cancels any sequence that uses one of its cards. Belot (K+Q of trump; in all-trumps, of any suit) always counts, 20 each. Announcements are allowed in every contract (belot excluded in no-trumps).
