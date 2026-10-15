# Quality report

Judged on `b0c130126df1b7f7d21f0cf9634629f31e184c2b` (2026-10-15). The setup card. Phone 390×844 and desktop 1440×900, through the verify stack (`wrangler dev` on :8790, fresh local D1, built app). No console errors. `a060934` is the failing spec. `b0c1301` is the fix. `afdfcc0` and `f481485` landed on main after these shots. The pictures do not include them.

## The setup card

`b0c1301` leaves the top bar above the card. The dim starts at y 72. The phone bar ends at y 58. The desktop bar ends at y 70. A tap on the dim felt leaves the card open.

Played from the lobby, and from a direct open, on Blackjack, Flip 7, and Exploding Kittens. The guide does not open on the card. It still opens the first time the table mounts.

### The bar

The center of the arrow, the book, history, mute, and settings is that control. Mute toggles and the card stays. The book opens the page. Escape closes the page and the card stays. Settings is music, effects, and motion, with no table buttons. Escape closes it and the card stays. History opens the list. Browser back from history returns to the card.

Blackjack's card is the description, Play, and Back. Flip 7 and Exploding Kittens add opponents (1, 2, 3) and difficulty (Easy, Medium, Hard). Nothing else is on the card.

Back under Play, the arrow, Escape, and browser back each land on the lobby. A direct open does too. The lobby is the bankroll, Neon Cards, and the three games. Play lands on the table. The first-visit page is over it. Closing that page leaves the felt.

### One round

Blackjack, rig `AH,9C,5S,7D,3C`, $25. Stage `playing`, bank `$1,250`, 9♣ and a hole card (`data-face` `hidden`). Hit keeps the hole down. No rule line.

Flip 7, rig `bust`. A still cursor on the 5 shows nothing. A tap shows nothing 2.2s later. Hit takes the pile 91 → 90. `seat-you` is busted. The line stays absent.

Exploding Kittens, seed `ek-gap-open`, two Medium CPUs. A still cursor on Shuffle does not raise it and does not open a rule. The first tap raises it (`translate(0, -36)`), shows "Shuffle the draw pile.", and leaves Play enabled. That tap sends nothing. Shuffle and Cattermelon disable Play. The reason is "Need a matching pair." The line is `nowrap` and does not scroll. The phone box is x 243, y 601, 123×16, ending at x 366 inside 390. The period glyph ends at x 366, and 24px of felt remain. The desktop box is x 1267, y 683, 165×22, ending at x 1432 inside 1440. The period glyph ends at x 1432. The disabled button is color rgb(109, 103, 128), background rgb(20, 16, 28), border rgb(58, 51, 72), no shadow, opacity 1. Play on Shuffle alone sends one `{ "type": "play", "title": "shuffle" }`. The hand goes 8 → 7 and the discard 0 → 1. The sentence is gone.

Nothing else from this pass is open. [#84](https://github.com/gertzgal/neon-cards/pull/84) was left alone.

![Phone, blackjack setup](quality/setup-phone-bj.jpg)
![Desktop, blackjack setup](quality/setup-desktop-bj.jpg)
![Phone, Flip 7 setup](quality/setup-phone-f7.jpg)
![Desktop, Flip 7 setup](quality/setup-desktop-f7.jpg)
![Phone, Exploding Kittens setup](quality/setup-phone-ek.jpg)
![Desktop, Exploding Kittens setup](quality/setup-desktop-ek.jpg)
![Phone, back to the lobby](quality/setup-phone-lobby.jpg)
![Desktop, back to the lobby](quality/setup-desktop-lobby.jpg)
![Phone, blackjack deal](quality/setup-phone-bj-deal.jpg)
![Desktop, blackjack deal](quality/setup-desktop-bj-deal.jpg)
![Phone, blackjack hit](quality/setup-phone-bj-hit.jpg)
![Desktop, blackjack hit](quality/setup-desktop-bj-hit.jpg)
![Phone, a tap on the 5](quality/setup-phone-f7-tap.jpg)
![Desktop, a tap on the 5](quality/setup-desktop-f7-tap.jpg)
![Phone, Flip 7 bust](quality/setup-phone-f7-hit.jpg)
![Desktop, Flip 7 bust](quality/setup-desktop-f7-hit.jpg)
![Phone, Shuffle raised](quality/setup-phone-ek-raised.jpg)
![Desktop, Shuffle raised](quality/setup-desktop-ek-raised.jpg)
![Phone, disabled Play](quality/setup-phone-ek-reason.jpg)
![Desktop, disabled Play](quality/setup-desktop-ek-reason.jpg)
![Phone, Shuffle played](quality/setup-phone-ek-played.jpg)
![Desktop, Shuffle played](quality/setup-desktop-ek-played.jpg)

The earlier passes below were on the SHAs named there.

Current with main `f0d64cf043cc5ffc90f0f566cba63312e8487047` (2026-10-15). The how-to page. Phone 390×844 and desktop 1440×900, through the verify stack (`wrangler dev` on :8790, fresh local D1, built app). No console errors. The felt fix was retested on `f8912e2`. `a443568` only adds the cloud-session hook and does not change the table.

## How to play

`f0d64cf` is [#78](https://github.com/gertzgal/neon-cards/pull/78). The first time a table mounts, a full-page guide opens over it. The book sits directly left of mute and opens it again. Closing with the X, GOT IT, or Escape writes the seen key, so a refresh stays on the felt. The lobby has no book.

Played Blackjack (`AH,9C,5S,7D,3C`, $25), Flip 7 (`rig=bust`, then a held Freeze), and Exploding Kittens (seed `ek-gap-open`, two Medium CPUs).

### The page

HOW TO PLAY, then the game title, then GOAL, YOUR TURN, THE CARDS, and WINNING. The footer is GOT IT ▶ PLAY. Nothing overflows the screen. Scrolled to the end, the last section sits above the footer (overlap 0) on both viewports. While the page is up, the table root is `inert`. A click on the page does not place a bet. The felt stays 0.

Blackjack says get closer to 21, HIT and STAND, an ace counts 1 or 11, faces count 10, numbers count their number, blackjack pays 3:2, and the dealer stands on all 17s. The three rows are the ace of spades, the king of hearts, and the 7 of diamonds. Flip 7 teaches the 7, Freeze, Flip Three, Second Chance, +4, and ×2, each with one sentence. Exploding Kittens teaches all 13 titles, in title order, from the kitten to Cattermelon.

The book is left of the speaker. On the phone the book is x 265–289 and the speaker is x 301. The desktop close button is x 1370, y 18, 52×52. X, Escape, and GOT IT each remove the page and clear `inert`. A reload stays on the felt, and the book is still there.

### After it closes

No guide node and no inert. Blackjack and Exploding Kittens have no leftover sentence. The book stays.

Blackjack. A $25 deal is stage `playing`, two cards each, hole down, bank `$1,250`. Hit adds the third card (total 9/19). Stand settles to betting at `$1,275`. No rule line.

Flip 7 on `f0d64cf`. Closing the page left "A second copy busts. Seven different numbers scores Flip 7." on the felt. It hid on its own after the deal beat. A still cursor on the 5 did not bring it back. A tap did, and it was still there 2.2s later. Hit then busted: the pile went 91 → 86, `seat-you` was busted, and the stage was `roundOver`.

[#81](https://github.com/gertzgal/neon-cards/pull/81) (`f8912e2`) keeps that sentence on the guide row and off the felt. Retested on both viewports. Right after close the rule line is absent. A still cursor and a tap on the 5 show nothing. Hit still busts, and the line stays absent. A tap on a held Freeze still shows "That player banks their score and sits this round out." and `data-pending` stays `target`. The guide row for the number still reads the sentence.

Exploding Kittens. Rest has no sentence. A still cursor on Shuffle does not raise it and does not open a rule. The first tap raises it (`translate(0, -36)`), shows "Shuffle the draw pile.", and sends nothing. Play is enabled. Raising Cattermelon as well disables Play. The reason is "Need a matching pair." The line is `nowrap` and does not scroll. The phone box is x 243, y 601, 123×16, ending at x 366 inside 390. The period glyph ends at x 366, and 24px of felt remain. The desktop box is x 1267, y 683, 165×22, ending at x 1432 inside 1440. The period glyph ends at x 1432. The disabled button is color rgb(109, 103, 128), background rgb(20, 16, 28), border rgb(58, 51, 72), no shadow, no filter, opacity 1. The phone button is x 214, y 623, 168×84. The desktop button is x 1232, y 711, 200×96. Lowering both hides the sentence and Play. Raising Shuffle and pressing Play sends one `{ "type": "play", "title": "shuffle" }`. The hand goes 8 → 7 and the discard 0 → 1. Draw takes the pile 29 → 26 and the hand 7 → 8, with no sentence of its own.

Nothing else from this pass is open. The phone Exploding Kittens strip still shows one full card and a peek. The desktop fan still meets the draw button the way it did on `bdbc4b6`. Double and Split stay on the blackjack felt. The guide page does not repeat them.

![Phone, blackjack guide](quality/guide-phone-bj-open.jpg)
![Desktop, blackjack guide](quality/guide-desktop-bj-open.jpg)
![Phone, blackjack after close](quality/guide-phone-bj-closed.jpg)
![Desktop, blackjack after close](quality/guide-desktop-bj-closed.jpg)
![Phone, blackjack deal](quality/guide-phone-bj-dealt.jpg)
![Desktop, blackjack deal](quality/guide-desktop-bj-dealt.jpg)
![Phone, blackjack hit](quality/guide-phone-bj-hit.jpg)
![Desktop, blackjack hit](quality/guide-desktop-bj-hit.jpg)
![Phone, Flip 7 guide](quality/guide-phone-f7-open.jpg)
![Desktop, Flip 7 guide](quality/guide-desktop-f7-open.jpg)
![Phone, the number sentence stuck](quality/guide-phone-f7-stuck.jpg)
![Desktop, the number sentence stuck](quality/guide-desktop-f7-stuck.jpg)
![Phone, Flip 7 after the fix](quality/guide-phone-f7-rest.jpg)
![Desktop, Flip 7 after the fix](quality/guide-desktop-f7-rest.jpg)
![Phone, a tap on the 5](quality/guide-phone-f7-tap.jpg)
![Desktop, a tap on the 5](quality/guide-desktop-f7-tap.jpg)
![Phone, Flip 7 bust](quality/guide-phone-f7-bust.jpg)
![Desktop, Flip 7 bust](quality/guide-desktop-f7-bust.jpg)
![Phone, Exploding Kittens guide](quality/guide-phone-ek-open.jpg)
![Desktop, Exploding Kittens guide](quality/guide-desktop-ek-open.jpg)
![Phone, Shuffle raised](quality/guide-phone-ek-raised.jpg)
![Desktop, Shuffle raised](quality/guide-desktop-ek-raised.jpg)
![Phone, disabled Play](quality/guide-phone-ek-reason.jpg)
![Desktop, disabled Play](quality/guide-desktop-ek-reason.jpg)
![Phone, Shuffle played](quality/guide-phone-ek-played.jpg)
![Desktop, Shuffle played](quality/guide-desktop-ek-played.jpg)

The earlier passes below were on the SHAs named there.

Current with main `3707ffa5ce97d1ea76b1c707910ffff928d60640` (2026-10-15). Judged from `88bcd30` through `b30dc33`, the held-sentence fix, and the phone-reason inset on this SHA, phone 390×844 and desktop 1440×900, through the verify stack (`wrangler dev` on :8790, fresh local D1, built app). No console errors.

## Raise, then Play

`88bcd30` raises a card in place. A second tap lowers it. Play, on the right, sends the one action. The rule is one sentence above the hand. Exploding Kittens and Flip 7 hands are a straight row. Blackjack stays a fan. The inspect panel is gone.

Played on `88bcd30` with Exploding Kittens seed `ek-gap-open` (two Medium CPUs), Flip 7, and the blackjack rigs. The disabled reason was played again on the build that includes `b30dc33`. Escape and a held Freeze were played again on `fb22720`.

### Exploding Kittens

Rest. No sentence, no Play, no inspect panel. The hand is a strip on one baseline (phone y 504, desktop y 564). A still cursor on Shuffle does not raise it and does not open a rule.

The first tap on Shuffle raises it (`translate(0, -36)`), shows "Shuffle the draw pile.", and leaves Play enabled. That tap sends nothing. The sentence stays off the draw pile (overlap 0). Play stays off the hand (overlap 0). A second tap lowers the card, hides the sentence and Play, and leaves the discard at 0. Play discards it: hand 8 → 7, discard 0 → 1. Draw takes the pile 29 → 26 and the hand 7 → 8, with no sentence of its own.

Two different titles disable Play. The reason text is "Need a matching pair." On `88bcd30` that line drew past the right edge and read as "Need a matching pai" on both viewports. [#73](https://github.com/gertzgal/neon-cards/pull/73) (`b30dc33`) keeps the line on one row and paints a disabled Play flat grey. Desktop, retested on `fb22720`, shows the full sentence. The box is x 1267, y 683, 165×22, ending at x 1432 inside 1440. The phone shot from that build still reads "Need a matching pai". The period sits in the right edge of the 390px screen. The layout box ended at x 382, and that box is not the ink. [#77](https://github.com/gertzgal/neon-cards/pull/77) (`3707ffa`) sits the phone line 16px in from the dock. Played again at 390×844. The period's ink ends at x 355, and 25px of felt remain before the edge. The line is one row and does not scroll. The disabled button is color rgb(109, 103, 128), background rgb(20, 16, 28), border rgb(58, 51, 72), no shadow, no filter, opacity 1. Phone button is x 214, y 623, 168×84. Desktop button is x 1232, y 711, 200×96. One raised card enables Play: a white label and a pink glow, `rgba(255, 46, 136, 0.8) 0 0 18px`.

A pair of Cattermelons raises without a POST, says "Pick a player.", and a seat tap enables Play without sending. Play sends the pair. Medium nopes it, so the hand goes 8 → 6. Favor raises with "Another player gives you one card." and "Pick a player." Play sends `{ "type": "favor", "target": "cpu-1" }` and the hand stays 8.

Nope has no separate button. Two taps do not send. The sentence is "Stop the card that was just played." Escape with Nope raised lowers it and leaves the window open. On `88bcd30` a second Escape stayed on `nope`. P passed. The key handler's DOM node was named `target`, which shadowed the picked seat, so Escape always cleared and returned. [#72](https://github.com/gertzgal/neon-cards/pull/72) (`f2915a7`) passes on the second Escape. Retested on `fb22720`: the first Escape lowers Nope and `data-pending` stays `nope`; the second Escape returns the table to `turn`.

The phone strip shows Shuffle at 150px and 82px of the next Cattermelon. The rest wait until the strip scrolls, which reveals Defuse at 150px. A scrolled card still raises. Desktop shows all eight cards at 180px. The hand ends at y 707 on the phone and y 807 on desktop. The draw button starts at y 774 and y 822. Overlap 0.

### Flip 7

Rest on `you=8,+10`, one Easy CPU. No sentence, no inspect panel, strip layout. A still cursor on the 8, and a tap on the 8, show nothing. +10 and ×2 show nothing. A drawn Freeze sentence hides on its own. Once it had hidden, a tap on the Freeze waiting in the middle showed nothing: that card is not on a seat. [#74](https://github.com/gertzgal/neon-cards/pull/74) (`fb22720`) looks at the card in the middle and a card set aside. The tap does not pick a target. Retested on both viewports: the sentence is "That player banks their score and sits this round out." and `data-pending` stays `target`. A bust still marks `seat-you` busted and the stage `roundOver`. Hit still draws.

### Blackjack

The raise diff does not touch blackjack. The fan stays. A $25 deal on rig `win` is stage `playing`, hole down, bank `$1,250`, with no inspect panel and no rule sentence.

The same player then ran the rigs, so later pill totals are not a fresh 1,250. History nets, newest first, are 50, 50, 0, −25, −50, 37, −50, 100, 150, 100, 50, −25. Oldest first: a $25 hit loss, a $50 stand (+50, and `data-last-net` was 50), double (+100), split eights (+150), split aces at 1:1 (+100), bust (−50), a natural on $25 (+37), dealer blackjack (−50), a ten-up stand (−25), an ace-up push (0), the resumed stand (+50), and the rebet stand (+50). Ten-up (`10H,10C,6S,7D`) and ace-up (`9H,AH,8S,6D`) keep the hole hidden while the stage is `playing`. Split aces settle to betting before the two hands can be counted on the felt. Reload on the plain path brings back 10♥, 9♠ against 9♣ and a hole card, the `win` rig. Rebet stays 50. A fresh player who loses 1,250 refills to pill 1,250, wallet 1,250, felt 0, with history −1,250.

Nothing else from this pass is open. The phone Exploding Kittens strip still shows one full card and a peek, then scrolls. That is the straight row from `88bcd30`.

![Phone, Exploding Kittens at rest](quality/raise-phone-ek-rest.jpg)
![Phone, Shuffle raised](quality/raise-phone-ek-raised.jpg)
![Phone, disabled Play, the period in the edge](quality/raise-phone-ek-reason.jpg)
![Phone, disabled Play, the period on the felt](quality/raise-phone-ek-reason-after.jpg)
![Desktop, Exploding Kittens at rest](quality/raise-desktop-ek-rest.jpg)
![Desktop, Shuffle raised](quality/raise-desktop-ek-raised.jpg)
![Desktop, disabled Play](quality/raise-desktop-ek-reason.jpg)
![Phone, Flip 7 at rest](quality/raise-phone-f7-rest.jpg)
![Phone, the 8](quality/raise-phone-f7-number.jpg)
![Phone, held Freeze](quality/raise-phone-f7-action.jpg)
![Phone, Flip 7 bust](quality/raise-phone-f7-bust.jpg)
![Desktop, Flip 7 at rest](quality/raise-desktop-f7-rest.jpg)
![Desktop, the 8](quality/raise-desktop-f7-number.jpg)
![Desktop, held Freeze](quality/raise-desktop-f7-action.jpg)
![Desktop, Flip 7 bust](quality/raise-desktop-f7-bust.jpg)
![Phone, blackjack deal](quality/raise-phone-bj-deal.jpg)
![Desktop, blackjack deal](quality/raise-desktop-bj-deal.jpg)

The earlier passes below were on the SHAs named there.

Current with main `6105ebb8ce6a1c54dc2db0210bcd2377804be539` (2026-10-15). Judged on that SHA, phone 390×844 and desktop 1440×900, through the verify stack (`wrangler dev` on :8790, fresh local D1, built app). `6105ebb` is [#69](https://github.com/gertzgal/neon-cards/pull/69), the fix for the pass on `37edf43`. No console errors.

## Press to read

`37edf43` is the three inspect commits: the rule only when you ask (`b696f7f`), the panel pinned under the HUD (`af2a507`), and read-before-play (`37edf43`). Played Flip 7 (`you=8,+10`, one Easy CPU) and Exploding Kittens (seed `ek-gap-open`, two Medium CPUs). Blackjack was one $25 deal, rig `AH,9C,5S,7D`.

On `37edf43` the rule was off the face until a tap or a hover, and Play on Shuffle still discarded it. Hit took the Flip 7 pile from 92 to 90. The panel was the problem. It was a tall card-plus-sentence under the HUD, and it covered the draw pile. Flip 7 phone: the panel ran y 58–345 over a pile at y 241–318. Desktop Flip 7 covered the whole pile (y 282–398). Desktop Exploding Kittens covered 77px of the 96px pile. The buttons stayed clear. Leaving the cursor on Play also opened the Flip 7 rule by itself, because the 8 deals into that spot.

[#69](https://github.com/gertzgal/neon-cards/pull/69) makes the panel a short row. It sits under the pile when that gap is free, and beside the pile when a modifier or the hand is already there. A card that lands under a still cursor stays closed until the pointer moves. Retested on `6105ebb`.

- Flip 7 rest, both viewports. No inspect panel, no rule sentence on the face, and the deal callout is gone once the table settles. The CPU `+9` is the score line that was already there.
- Asking for the 8 opens “A second copy busts. Seven different numbers scores Flip 7.” Phone panel is x 117, y 326, 156×121. The pile ends at y 318, the hand starts at y 504, the buttons at y 774. Overlap with the pile, the hand, the slots, and the buttons is 0. Desktop panel is x 570, y 406, 300×112, under a pile that ends at y 398 and above a hand at y 564. Overlap 0. Escape closes it. Hit still draws: the pile goes 92 → 90.
- Three CPUs and a +10 already out. Phone and desktop panels sit beside the pile. Overlap with the pile, the +10, the slots, the hand, and the buttons is 0.
- Exploding Kittens rest. Titles stay on the faces. The rule sentences do not. No panel.
- Phone tap opens the card under the finger (Cattermelon, on top of the fan). The panel is y 436–528. The pile ends at y 428. The hand cards start at y 585. Overlap 0. Desktop hover on Shuffle opens “Shuffle the pile.” The panel is x 757, beside a pile that ends at x 749. Overlap 0.
- Play still plays a single card. On the phone, Play and a second tap each discard Shuffle (hand 8 → 7, discard 1). On desktop, the hover does not play, the click after the hover does not play, and Play does (discard 1, Shuffle on the discard). Draw still draws: the pile goes 29 → 26 on both viewports.
- Blackjack. $25, stage `playing`, bank `$1,250`, two cards each, hole down, Hit and Stand up. No inspect panel.

Nothing else from this pass is open. The desktop Exploding Kittens fan still meets the draw button the way it did on `bdbc4b6`.

![Phone, Flip 7 before you ask](quality/inspect-phone-f7-rest.jpg)
![Phone, Flip 7 rule](quality/inspect-phone-f7.jpg)
![Phone, Flip 7 after Hit](quality/inspect-phone-f7-hit.jpg)
![Phone, Flip 7 +10 with three CPUs](quality/inspect-phone-f7-mod.jpg)
![Desktop, Flip 7 before you ask](quality/inspect-desktop-f7-rest.jpg)
![Desktop, Flip 7 rule](quality/inspect-desktop-f7.jpg)
![Desktop, Flip 7 after Hit](quality/inspect-desktop-f7-hit.jpg)
![Desktop, Flip 7 +10 with three CPUs](quality/inspect-desktop-f7-mod.jpg)
![Phone, Exploding Kittens before you ask](quality/inspect-phone-ek-rest.jpg)
![Phone, Exploding Kittens rule](quality/inspect-phone-ek.jpg)
![Phone, Exploding Kittens after a draw](quality/inspect-phone-ek-drew.jpg)
![Desktop, Exploding Kittens before you ask](quality/inspect-desktop-ek-rest.jpg)
![Desktop, Exploding Kittens rule](quality/inspect-desktop-ek.jpg)
![Desktop, Shuffle played](quality/inspect-desktop-ek-played.jpg)
![Phone, blackjack deal](quality/inspect-phone-bj.jpg)
![Desktop, blackjack deal](quality/inspect-desktop-bj.jpg)

The earlier passes below were on the SHAs named there.

## Card faces

Current with main `d3d0e35c591ec484bc95cb79e47f7e92e0386cb5` (2026-10-15). Judged on that SHA, phone 390×844 and desktop 1440×900, through the verify stack (`wrangler dev` on :8790, fresh local D1, built app). `d3d0e35` is [#63](https://github.com/gertzgal/neon-cards/pull/63): physical-layout faces (`4316d00`) and the phone-hand type size (`6d6148d`). The two commits after `6d6148d` only retrigger CI. No console errors.

## Card faces

Played the way a round goes. Blackjack is still the mock: a dark face, an oversized corner rank, one center pip, and a face-down hole. Hearts came up pink. Spades and clubs came up cyan. Flip 7 numbers are the card. A modifier is the mark, in the compact extra row. Exploding Kittens cards are a title, a pixel scene, and one rule line. The table did not grow any extra words.

- Blackjack, rig `AH,9C,5S,7D,3C`, $25. Deal shows A♥ and 5♠ against 9♣ and a hole card. The hole stays down. Hit adds 3♣ and the hand stays in play (soft 19). Phone ranks are 55px on the player cards and 30px on the dealer. Desktop is 53px and 33px. Every rank's box stays inside its card. Phone hand box ends at y 707; the buttons start at y 710. The rotated corners reach y 717 and graze the button box. The HIT label stays clear. Desktop hand ends at y 798, buttons at y 822.
- Flip 7, rig `you=8,+10`, one Easy CPU. The 8 fills the hand card (117px on a 150×203 phone card, 140px on a 180×243 desktop card). +10 sits above it (31px on a 42×57 phone card, 53px on a 71×96 desktop card). Both marks stay inside the frame. Neither card meets the HUD or the buttons. The only numeral on the CPU is 12.
- Exploding Kittens, seed `ek-gap-open`, two Medium CPUs. The hand is Shuffle, Cattermelon, Skip, Skip, Favor, Tacocat, Cattermelon, Defuse. On the phone the cards run from x 16 to 374, the same span as `bdbc4b6`. The lowest corner is y 730 and the draw button is y 774. The owed digit reads 1 at (16, 14). Cattermelon is 16px, one line, inside the card. Rules are 18px. Desktop is the same fan as that pass: x 258 to 1182, digit at x 1170. The outer corners still cross the top of the draw button (Shuffle and Defuse end at y 854, the button starts at y 822). DRAW in the middle stays clear. That overlap is the fan from [#61](https://github.com/gertzgal/neon-cards/pull/61), not a new face.

No face was clipped, and no new bug turned up. Nothing is open.

![Phone, blackjack deal](quality/faces-phone-bj-deal.jpg)
![Phone, blackjack hit](quality/faces-phone-bj-hit.jpg)
![Desktop, blackjack deal](quality/faces-desktop-bj-deal.jpg)
![Desktop, blackjack hit](quality/faces-desktop-bj-hit.jpg)
![Phone, hole card](quality/faces-phone-bj-hole.jpg)
![Desktop, hole card](quality/faces-desktop-bj-hole.jpg)
![Phone, ace](quality/faces-phone-bj-ace.jpg)
![Phone, the hit](quality/faces-phone-bj-hit-card.jpg)
![Phone, Flip 7 eight](quality/faces-phone-f7-number.jpg)
![Phone, Flip 7 +10](quality/faces-phone-f7-mod.jpg)
![Desktop, Flip 7 eight](quality/faces-desktop-f7-number.jpg)
![Desktop, Flip 7 +10](quality/faces-desktop-f7-mod.jpg)
![Phone, the eight](quality/faces-phone-f7-eight.jpg)
![Phone, +10](quality/faces-phone-f7-plus10.jpg)
![Desktop, +10](quality/faces-desktop-f7-plus10.jpg)
![Phone, Exploding Kittens hand](quality/faces-phone-ek.jpg)
![Desktop, Exploding Kittens hand](quality/faces-desktop-ek.jpg)
![Phone, Cattermelon](quality/faces-phone-ek-cattermelon.jpg)
![Desktop, Cattermelon](quality/faces-desktop-ek-cattermelon.jpg)

The earlier passes below were on the SHAs named there.

## Exploding Kittens

Played on `cede64d` the way a round goes. A score game: no wallet, no chips. The owed count is a digit. The only juice words are `NOPE` and `BOOM`. Seat names and the difficulty line are in the DOM and `display: none`, same as Flip 7. A rig URL starts a fresh sheet. The plain `/games/exploding-kittens` path resumes the stored session.

- Lobby tile, then the sheet. Default is 2 opponents, Medium. The line on the sheet is "Draw cards. Do not explode. Last one alive wins."
- Hard, 3 CPUs. Eight face-up cards, three rows of backs, draw pile 23, owed digit 1.
- Draw. The hand goes 8→9 on one POST. A double-click sends one POST and one more card.
- `D` draws. On seed `ek-gap-open` it drew the kitten and opened the defuse prompt.
- Resume. The plain path brings the same cards back, including an open defuse prompt.
- Defuse (`?rig=kitten`). 35 insert slots. The bottom slot plants index 34. Digit `1` plants on top and `known-top` is 1.
- Explode (`?rig=explode`). `BOOM`, `game-over` is `cpu-1`, your seat is empty. History says `LOSE` / `Round 1` for `exploding-kittens`. The filter row is All / Blackjack / Flip 7 / Exploding Kittens, because more than one game has rows.
- Nope (`?rig=nope&seed=ek-e2e-nope-6`). Attack opens the window (`nopes` 1, effect attack). Noping it, or Pass, returns to your turn.
- Favor (`?rig=favor`). The seat lights. Medium nopes it. The hand goes 8→7.
- Shuffle, See the Future, Skip, and Attack, on Easy. One copy plays on the first tap. A second copy selects, then plays. See the Future leaves `known-top` at 3.
- Easy, one CPU. One draw takes the pile from 35 to 34.
- Five rig, seed `ek-e2e-win-38`. The hand is the scripted eight cards and the discard count is 1. The URL seed is the deal.
- Blackjack from the lobby: $25, deal, stage `playing` (desktop total 14).
- Flip 7 from the lobby: Play, stage `playing`, Hit enabled once the deal settles.

On `cede64d` at 390px the owed digit sat beside the fan. Shuffle started at x −44 and Defuse ended at x 350. Desktop kept that same seed from x 258 to 1182, with the digit beside the hand at x 1170.

[#61](https://github.com/gertzgal/neon-cards/pull/61) puts the phone digit in the top bar and limits the fan to `width - 64`. The shared kit is unchanged. Retested on `bdbc4b6` with seed `ek-gap-open`: the phone cards run from x 16 to 374, the digit reads 1 at (16, 14), there is no wallet, and the hand box ends at y 707 above the draw button at y 774. Desktop is the same fan, digit still beside the hand.

![Phone, hand off the screen](quality/ek-phone-clipped.jpg)
![Phone, hand on the screen](quality/ek-phone-fixed.jpg)
![Desktop, opening hand](quality/ek-desktop-opening.jpg)
![Phone, defuse](quality/ek-phone-defuse.jpg)
![Desktop, defuse](quality/ek-desktop-defuse.jpg)
![Phone, nope](quality/ek-phone-nope.jpg)
![Desktop, nope](quality/ek-desktop-nope.jpg)
![Phone, boom](quality/ek-phone-boom.jpg)
![Desktop, boom](quality/ek-desktop-boom.jpg)
![Phone, see the future](quality/ek-phone-future.jpg)
![Desktop, see the future](quality/ek-desktop-future.jpg)
![Desktop, shuffle](quality/ek-desktop-shuffle.jpg)
![Desktop, attack](quality/ek-desktop-attack.jpg)
![Desktop, favor](quality/ek-desktop-favor.jpg)
![Phone, history](quality/ek-phone-history.jpg)
![Desktop, history](quality/ek-desktop-history.jpg)
![Phone, blackjack](quality/ek-phone-blackjack.jpg)
![Desktop, blackjack](quality/ek-desktop-blackjack.jpg)
![Phone, Flip 7](quality/ek-phone-flip7.jpg)
![Desktop, Flip 7](quality/ek-desktop-flip7.jpg)

The earlier passes below were on the SHAs named there.

## Instant actions

The pass below is `ea1c952897173ba67ae2a724b9fdcc87aaa8fec3` ([#52](https://github.com/gertzgal/neon-cards/pull/52)): a blackjack action is two D1 round trips, and hit, stand, double, and split start the non-secret motion on the click. Under it, `a9af660` shows the wallet on a resumed hand, and `4df911c` keeps the desktop stake off the player cards and paints the hole card's back.

Played on `ea1c952`, phone 390×844 and desktop 1440×900. The pill, the wallet, and history agreed on every round below. No console errors.

## Instant actions

A fresh $1,250 player each time. The same-turn read is the DOM in the click, before the response can land.

- Hit on 11. The third card is face-down, the total stays 11, the pill stays $1,250. It flips to 10♣ and the hand wins. Wallet $1,300, history +50. One POST.
- Double on 11. The pot is $100 and the third card is face-down in the click. The pill stays $1,250. Settles +100, wallet $1,350.
- Stand on 19. The hand is stood in the click, and the hole card stays down. Wins +50, wallet $1,300.
- Split 8s. Two hands and two face-down cards in the click, pill $1,250, pot $100. The faces land 8♥3♣ and 8♠10♦. Double the first (a face-down third card, that hand's bet $100, pill still $1,250), stand the second. Both win, net +150, wallet $1,400. History says `WIN · WIN` / `+$150`.
- Split aces. One face-down card each in the click. Both 21s pay 1:1, net +100, wallet $1,350.
- Bust. Two hits in one turn add one face-down card. It is the king. Net −50, wallet $1,200. History says `BUST` / `-$50` / 10♥6♠K♣. One POST.
- A $25 natural, skipped by a tap, settles in 878 ms on the phone and 872 ms on desktop. Wallet $1,287, history +37. Left alone, a $50 natural pays +75, wallet $1,325.
- Dealer blackjack. The hole flips to K♦, the dealer shows 21, net −50, wallet $1,200.
- Peek. A ten up and an ace up both keep the hole face-down. The back is `filter: none` on `rgb(42, 6, 25)`. Standing on the ten loses 25 (wallet $1,225). Standing on the ace, dealer soft 17, wins 25 (wallet $1,275).
- Double-clicked DEAL sends two identical bets at seq 0. The server keeps one round: 10♥9♠ against a down hole. A chip click, H, and Space during the deal do not add a card or a round. Stand pays +50 (wallet $1,300). The rebet pays another +50 (wallet $1,350). History is two +50s. A double-clicked HIT sends one POST.
- Resume. Leaving `?rig=win` for `/games/blackjack` and reloading shows the same 10♥9♠, hole down, pill `$1,250`, on both viewports. Stand pays $1,300, matching the wallet.
- Flip 7. Play on the sheet starts round 1, and Hit enables when the deal finishes. The chip wallet stays $1,250. The table shows the score pill.

![Phone, hit in flight](quality/phone-instant-hit.jpg)
![Desktop, hit in flight](quality/desktop-instant-hit.jpg)
![Phone, split](quality/phone-instant-split.jpg)
![Desktop, split](quality/desktop-instant-split.jpg)
![Phone, bust](quality/phone-instant-bust.jpg)
![Desktop, bust](quality/desktop-instant-bust.jpg)
![Phone, blackjack](quality/phone-instant-blackjack.jpg)
![Desktop, blackjack](quality/desktop-instant-blackjack.jpg)
![Phone, dealer blackjack](quality/phone-instant-dealerbj.jpg)
![Desktop, dealer blackjack](quality/desktop-instant-dealerbj.jpg)
![Phone, ace up, hole down](quality/phone-instant-peek.jpg)
![Desktop, ace up, hole down](quality/desktop-instant-peek.jpg)
![Phone, resumed hand](quality/phone-instant-resume.jpg)
![Desktop, resumed hand](quality/desktop-instant-resume.jpg)
![Phone, split history](quality/phone-instant-history.jpg)
![Desktop, split history](quality/desktop-instant-history.jpg)
![Phone, skip settled](quality/phone-instant-skip.jpg)
![Desktop, skip settled](quality/desktop-instant-skip.jpg)
![Phone, Flip 7 round](quality/phone-instant-flip7.jpg)
![Desktop, Flip 7 round](quality/desktop-instant-flip7.jpg)

The earlier passes below were on the SHAs named there.

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

Nothing from the card-face pass on `d3d0e35` is open. The phone fan on `cede64d` is fixed in [#61](https://github.com/gertzgal/neon-cards/pull/61). The resume-pill fix is [#53](https://github.com/gertzgal/neon-cards/pull/53), merged. No new bug on the earlier `ea1c952` pass.

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

No open PRs. [#63](https://github.com/gertzgal/neon-cards/pull/63) is merged (`d3d0e35`). [#61](https://github.com/gertzgal/neon-cards/pull/61) and [#62](https://github.com/gertzgal/neon-cards/pull/62) are merged. [#52](https://github.com/gertzgal/neon-cards/pull/52) is merged (`ea1c952`). [#33](https://github.com/gertzgal/neon-cards/pull/33) is closed. [#46](https://github.com/gertzgal/neon-cards/pull/46) and [#53](https://github.com/gertzgal/neon-cards/pull/53) are merged.

## Left

Flip 7's own later list, not quality bugs: the bust-% assist meter, Hard splitting a set-aside Freeze and Flip Three onto different seats, a history recap, and the solo 200-point challenge. No quality bug is waiting on a fix. The desktop Exploding Kittens fan still meets the draw button the way it did on `bdbc4b6`.
