# Quality report

Current with main `a9af6609419b82b4dbe43303f77c7b8b2bfc141b` (2026-10-15). That commit shows the wallet on a resumed blackjack hand. Under it, `4df911c` keeps the desktop stake off the player cards and paints the hole card's back.

Played on that SHA, phone 390×844 and desktop 1440×900, through the verify stack (`wrangler dev` on :8790, fresh local D1, built app).

Flip 7 is registered and playable (table [#35](https://github.com/gertzgal/neon-cards/pull/35), e2e `8aedbf6`). The pass below on `305a0ed` is the earlier one: at that SHA the package exported rules only, so a round could not be played. Blackjack payouts have not changed since the rig pass on `c059d6a`.

The full animated blackjack rule pass (every named rig, wallet and history after each round) was on `c059d6a`. Music and the reshuffle cue were checked on `98de7bd`. On `21c516c` both viewports played a natural, a bust, a split with double after split, history, and a mid-hand resume. On `34e37b5` both viewports rechecked the dealer total, the tray between rounds, a six-card hand, and the blackjack burst. On `b62dcd3` both viewports rechecked a $50 rebet across reload and History, and an all-in that refills to $1,250 without staking it. On `b7a9acf` both viewports rechecked a tap and a key that skip the round, and a round left alone that still plays out. On `305a0ed` both viewports rechecked a mid-hand New game and the table pill against the wallet. Payouts did not change in any of those commits.

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

On `21c516c`, a $25 natural is wallet 1,287 (+37). Resume from `/games/blackjack` (no `?rig=`) brings the same two cards back. The bust after that is 1,262. Split 8s with a double, against a dealer bust, is 1,337, and history reads `WIN · WIN` / `+$75`, then `BUST` / `-$25`, then `BLACKJACK` / `+$37`. No console errors.

Wallet matched the round's net on the earlier rig pass too.

## Already on main

- No dealer tray during betting. Chips are 5 cyan, 25 pink, 100 violet, 500 gold. Desktop bankroll is 40px with 34px icons.
- The blackjack burst stays off the dealer's cards.
- **B9** History and lobby. Rows are the outcome, the hand, the net, and a short time (`now`). No game name, no All/Blackjack filter, no rules blurb, no Chips tag. [#39](https://github.com/gertzgal/neon-cards/pull/39) is merged.
- **B2** The synthwave loop starts on the first tap and follows Music, mute, and reload. [#37](https://github.com/gertzgal/neon-cards/pull/37) is merged.
- **B7** A reshuffle is six card backs and a riffle, no label. The duplicate reshuffle PR #41 is closed.
- **B4** On a phone the dealer total stays on screen as the dealer draws (badge right edge 382 on a 390-wide screen, through a total of 11). [#40](https://github.com/gertzgal/neon-cards/pull/40) is merged. The duplicate long-hand PR #42 is closed.
- **B6** After a round the dealer row is already hidden (`visibility: hidden`, opacity 0) and its fade transition is `none`. No empty tray.
- **B10** A six-card player hand stays inside the phone (left edge x 11, right edge 283) and its lowest corner sits above the buttons (681 vs 710). On desktop it stays inside too.
- **B11** Across the blackjack burst, zero chips overlapped the player's cards on either viewport.
- **B3** Going broke on an all-in refills to $1,250 and leaves the felt empty. Deal stays disabled. The wallet is 1,250. [#36](https://github.com/gertzgal/neon-cards/pull/36) is merged.
- **B8** After a round the last bet is back on the felt, including after a reload and a trip to History. [#36](https://github.com/gertzgal/neon-cards/pull/36) is merged. The duplicate rebet PR #38 is closed.
- **B5** A tap during a $25 natural settles it in under a second (865 ms on phone, 869 ms on desktop). The wallet is 1,287, the net is +37, and the $25 is back on the felt. Left alone, the same round still plays out (3.9 s phone, 4.0 s desktop) for the same money. A tap mid-deal lands on the live hand (19, Stand enabled). Space during the dealer play settles a win (+25, wallet 1,275) about 610 ms after the key and does not deal another round. [#43](https://github.com/gertzgal/neon-cards/pull/43) is merged.
- **B1** New game during a dealt 16 forfeits the $25. The pill and the wallet are $1,225. History says `FORFEIT`, `-$25`, and the two cards. [#46](https://github.com/gertzgal/neon-cards/pull/46) is merged (`3f609d4`, `6db260b`). [#34](https://github.com/gertzgal/neon-cards/pull/34) was closed as superseded, not merged.
- **B12** The table pill shows the wallet. $100 on the felt leaves the pill at $1,250. Mid-hand it stays $1,250. After the win it is $1,350 on the table, in History, and on the lobby, with the $100 still on the felt. `fd1e6af`. A reload of a $25 hand in play used to paint `$1,225` while `data-value` was 1250, because the digits seeded from `stack`. [#53](https://github.com/gertzgal/neon-cards/pull/53) (`a9af660`) seeds them from the wallet. On this SHA, leaving the rig URL for `/games/blackjack` and reloading shows `$1,250` on both viewports, hole card still down. The resume spec then stands and expects $1,300.
- **Desktop stake and hole card** (`4df911c`, spot-checked on this SHA at 1440×900). After a $25 deal the chip's bottom sits 169px above the player cards, and the boxes do not overlap. The hole card is `hidden`, its inner layer is the svg plus-pattern back on `rgb(42, 6, 25)`, and the card filter is `none`. Phone keeps the same back and a 142px gap.

![Phone lobby](quality/phone-lobby.jpg)
![Desktop lobby](quality/desktop-lobby.jpg)
![Phone history](quality/phone-history.jpg)
![Desktop history](quality/desktop-history.jpg)
![Phone reshuffle](quality/phone-reshuffle.jpg)
![Desktop reshuffle](quality/desktop-reshuffle.jpg)
![Phone blackjack](quality/phone-blackjack.jpg)
![Desktop blackjack](quality/desktop-blackjack.jpg)

## Still open

Nothing in the quality list is still open. The resume-pill regression is [#53](https://github.com/gertzgal/neon-cards/pull/53), merged. No new bug turned up on this pass.

## Flip 7

Played on `a9af660`, both viewports, the way a round actually goes. It is a score game: first to 200. The chip wallet stayed $1,250 through busts, a Flip 7, freezes, Flip Threes, a game that crossed 200, history, and a reload. History rows for those rounds show a score and a net of 0.

- A hit deals one card into the next slot. Stay ends the line. The tally is numbers (`11 ×2 +4`), including the ×2 and +N modifiers.
- A repeated number with no Second Chance pops `BUST` and that round scores 0.
- Second Chance eats the duplicate and discards it. The line stays in.
- Seven different numbers: the slots run gold, `FLIP 7!` pops, +15 lands, and the round ends.
- Freeze asks for a seat, then that CPU is iced and draws nothing further. Flip Three deals three cards to the seat you pick.
- One, two, and three CPU seats, on Easy, Medium, and Hard. Seats are position only. The kit names are hidden.
- The only words on the table are `FLIP 7!` and `BUST`. Hit, Stay, and Next are icons.
- Crossing 200 ends the game on a gold crown when you win.
- A reload mid-round brings the same cards back. `H` hits, `S` stays, Space and Enter start the next round.
- The lobby tile is there. `POST /api/sessions` with `gameId: "flip7"` opens a session.

Shots from this pass live in `docs/quality/` (`phone-flip7-*`, `desktop-flip7-*`). The older `phone-flip7.jpg` and `desktop-flip7.jpg` are the `305a0ed` lobby, from when the tile was absent.

![Phone, in a round](quality/phone-flip7-playing.jpg)
![Desktop, in a round](quality/desktop-flip7-playing.jpg)
![Phone, bust](quality/phone-flip7-bust.jpg)
![Desktop, bust](quality/desktop-flip7-bust.jpg)
![Phone, Flip 7](quality/phone-flip7-moment.jpg)
![Desktop, Flip 7](quality/desktop-flip7-moment.jpg)
![Phone, game won](quality/phone-flip7-win.jpg)
![Desktop, game won](quality/desktop-flip7-win.jpg)
![Phone, Flip 7 history](quality/phone-flip7-history.jpg)
![Desktop, stake clear of the cards](quality/desktop-stake.jpg)
![Desktop, resumed hand at $1,250](quality/desktop-resume-pill.jpg)
![Phone, resumed hand at $1,250](quality/phone-resume-pill.jpg)

## Other open PRs

[#52](https://github.com/gertzgal/neon-cards/pull/52) is an open draft (two fewer D1 round trips, instant non-secret blackjack actions). Left alone. [#33](https://github.com/gertzgal/neon-cards/pull/33) is closed. [#46](https://github.com/gertzgal/neon-cards/pull/46) and [#53](https://github.com/gertzgal/neon-cards/pull/53) are merged.

## Left

Flip 7's own later list, not quality bugs: the bust-% assist meter, Hard splitting a set-aside Freeze and Flip Three onto different seats, a history recap, and the solo 200-point challenge. No quality bug is waiting on a fix.
