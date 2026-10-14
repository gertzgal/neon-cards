# Quality report

Played on main `98de7bdfe869c62982a58a6d327bf7454653ad35` (2026-10-14), phone 390×844 and desktop 1440×900, through the verify stack (`wrangler dev` on :8790, fresh local D1, built app). Flip 7 is not registered on main, so it was not played.

The full animated rule pass (every named rig, wallet and history after each round) was on the parent `c059d6a`, before the music and reshuffle commits. Those two commits do not change payouts. History and the lobby were judged again on `98de7bd`.

## What was played

Both viewports, fresh player at $1,250 unless noted:

- Lobby, settings, history, an unknown URL, and Calm motion.
- Betting: chips 5/25/100/500, clear, deal disabled at 0.
- Blackjack pays 3:2. A $25 natural is +37 (wallet 1,287). A $5 natural is +7 (wallet 1,257), then the $5 goes back on the felt.
- Dealer blackjack ends the hand at once (−25). An ace or ten up with no dealer blackjack keeps the hand in play, and the hole card stays face-down.
- Bust, push, win, lose, dealer bust, dealer stands on soft 17.
- Double on 11. Split 8s with double after split, no re-split, against a dealer bust (+75). Split aces: one card each, two 21s pay 1:1 (+50). A split that wins one hand and pushes the other pays +25 and history says `WIN · PUSH`.
- No insurance, no surrender.
- Going broke on an all-in refills to $1,250 once. A reload does not refill again.
- Resume after a reload mid-hand brings back the same cards and the bet.
- Double-click DEAL, chip clicks during the deal, and H/S/Space/Backspace do not create a second round.
- Music: nothing plays before the first tap. After it, the loop runs. Music off, a reload, and mute each schedule 0 oscillators. Music on and unmute bring it back. Same on the table, not only the lobby.
- Reshuffle: the shoe was played down under 25% (74 of 312), then DEAL. Six card backs riffle, with no text, and the next hand deals from a rebuilt shoe (308 of 312).

Wallet matched the round's net on every scripted path above. No console errors on the `98de7bd` pass.

## Already on main

- No dealer tray during betting. Chips are 5 cyan, 25 pink, 100 violet, 500 gold. Desktop bankroll is 40px with 34px icons.
- The blackjack burst stays off the dealer's cards.
- **B9** History and lobby. Rows are the outcome, the hand, the net, and a short time (`now`). No game name, no All/Blackjack filter, no rules blurb, no Chips tag. [#39](https://github.com/gertzgal/neon-cards/pull/39) is merged.
- **B2** The synthwave loop starts on the first tap and follows Music, mute, and reload. [#37](https://github.com/gertzgal/neon-cards/pull/37) is merged.
- **B7** A reshuffle is six card backs and a riffle, no label. The duplicate reshuffle PR #41 is closed.

![Phone lobby](quality/phone-lobby.jpg)
![Desktop lobby](quality/desktop-lobby.jpg)
![Phone history](quality/phone-history.jpg)
![Desktop history](quality/desktop-history.jpg)
![Phone reshuffle](quality/phone-reshuffle.jpg)
![Desktop reshuffle](quality/desktop-reshuffle.jpg)
![Phone blackjack](quality/phone-blackjack.jpg)
![Desktop blackjack](quality/desktop-blackjack.jpg)

## Still open

Left alone. Owners are finishing them.

| Bug | What you still see | PR |
| --- | --- | --- |
| B1 | New game mid-hand refunds the bet. A dealt 500 came back as $1,250 with no history row. | [#34](https://github.com/gertzgal/neon-cards/pull/34) |
| B3, B8 | An all-in refill no longer sticks the HUD at $0 (the felt stayed empty at $1,250). The last bet is still dropped after a reload or a trip to History. | [#36](https://github.com/gertzgal/neon-cards/pull/36) |
| B4 | On a phone, the dealer total runs off the right edge once the dealer has 3 or more cards (badge at x 343–417 on a 390-wide screen). | [#40](https://github.com/gertzgal/neon-cards/pull/40) |
| B5 | A tap during the round does not skip it. | [#43](https://github.com/gertzgal/neon-cards/pull/43) |
| B6 | After the cards sweep off, the empty dealer tray still has its own 250ms fade. | [#40](https://github.com/gertzgal/neon-cards/pull/40) |
| B10 | On a phone, a six-card player hand crosses the left edge (card at x −3). | [#42](https://github.com/gertzgal/neon-cards/pull/42) |
| B11 | On a phone the blackjack burst piles onto your own hand. | [#40](https://github.com/gertzgal/neon-cards/pull/40) |
| B12 | The table pill subtracts a bet that is sitting on the felt. History and the lobby show the full wallet. The prototype does the same. | grouped with [#34](https://github.com/gertzgal/neon-cards/pull/34) |

[#38](https://github.com/gertzgal/neon-cards/pull/38) is a second open PR for B8. Not touched.

Nothing new failed that those PRs do not already cover, so this pass has no fix PR.

## Flip 7

Not on main (`packages/games` is blackjack only). Not played.

- [#28](https://github.com/gertzgal/neon-cards/pull/28) feat(flip7): pure rules
- [#31](https://github.com/gertzgal/neon-cards/pull/31) feat(flip7): Easy, Medium, and Hard CPU policies
- [#35](https://github.com/gertzgal/neon-cards/pull/35) feat(flip7): playable neon table

## Other open Blackjack PRs

Not touched.

- [#33](https://github.com/gertzgal/neon-cards/pull/33) feat(blackjack): compose the table from UI kit primitives
- [#38](https://github.com/gertzgal/neon-cards/pull/38) fix(blackjack): keep the auto-rebet after a reload or History (B8)
- [#40](https://github.com/gertzgal/neon-cards/pull/40) fix(blackjack): phone dealer row and total badge
- [#42](https://github.com/gertzgal/neon-cards/pull/42) fix(blackjack): long player hands stay on screen
- [#43](https://github.com/gertzgal/neon-cards/pull/43) fix(blackjack): tap or key skips the round

## Left

Land the open PRs above. Then play Flip 7 the same way, on phone and desktop, once #35 is on main.
