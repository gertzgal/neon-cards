# Multiplayer table UX

Gal approves this picture before a game pull request builds either table for more than one human. This pull request does not deal a multiplayer hand. It does not change room runtime, engine behavior, or solo play.

The room already owns the chair, the clock, and the private view. Exploding Kittens and Blackjack only teach the room what their cards mean. They do not grow a second room.

The stills are `docs/multiplayer/ux/`. The page that draws them is `apps/web/ux-preview.html`. The lobby does not link to that page. Vite's production input does not include it, so the worker build does not ship it.

## The room stays in charge

`packages/room` and the worker already provide the pieces below. A game reads them off the live frame. It does not rebuild them.

- The code, the host, Deal, rematch, sit, leave, and watch.
- Presence, reconnect, and the 15 second host grace.
- Seat names. A CPU also gets the 8-bit bot. A covered friend keeps the nickname and gains the bot.
- The eye counter, `spectator-count`, on the shell.
- Per-seat delivery. The room calls `view` and sends that frame. The table does not hide a card a second time.
- The clock in `packages/room/src/clock.ts`. A human turn is 30 seconds, `TURN_MS`. A quick window is 5 seconds, `QUICK_MS`. `schedule` arms the next deadline after every committed action. The first miss plays `autoAct` and leaves the chair human. The second miss flips the chair to CPU. A quick-window timeout plays the decline action and does not add a miss.

The table paints `frame.deadline` as a seconds badge. A local tick may count down between frames. When a frame arrives, the badge jumps to the server time. The table does not call `setAlarm`, does not count misses, and does not decide that a chair has become a CPU.

## What Exploding Kittens still teaches

Exploding Kittens is already a room game. `view` already returns the acting seat's faces and a count for everyone else. A watcher gets no hand. `quick` is already `pass` and `nope`, and the decline is `pass`. This spec does not re-register the game and does not change those rules.

The table still has to paint the moments below when the other chairs are humans. The rules stay the source of what is legal. The table only sends the action the menu already lists.

### Hands and counts

Opponent rows are card backs plus a count badge. Faces stay in the owning seat's view. Show at most four backs. The badge is the full count, including a count above four. Eight full-size backs overlap on a 360 by 640 screen, and shrinking all eight of them makes the titles unreadable. The count is the fact. The backs are the texture.

A living seat with no cards shows an empty row and a count of 0. A dead seat shows OUT and no backs after the explosion beat below.

`ek-hands` is this picture. Ash holds five faces. Mira's badge reads 8, Nova's reads 6, and Pip's reads 5, each with four backs. Pip keeps the bot.

### Favor between humans

The actor raises Favor and picks any other living seat. Humans and CPUs are both legal targets. The pick ring is the same.

If the target holds two or more cards, only that seat sees faces and the Give button. Every other seat sees Favor on the discard, the two counts, and whose turn it is. The given card's face is not on their view. A one-card hand moves inside the action, so nobody gets a Give prompt.

The 30 second timer sits on the seat who must answer. During the pick, that is the actor. During the give, that is the target.

`ek-favor` is Ash choosing a target. `ek-give` is Ash handing a card to Mira after Mira played Favor.

### A steal between humans

A pair steals a random card. The thief's next view contains that face. Every other view sees the two counts change and does not see the face. The victim does not pick the card. A CPU target uses the same counts.

A three that hits shows the named title once, because that event is public, and then the card lives only in the thief's hand. A miss shows no face and does not change the counts.

`ek-steal` is Ash with two Tacocats raised and Mira chosen. The 30 second badge is on Ash.

### Attack

Attack is public on the discard. After the Nope window, the next living seat becomes the active seat and the status reads x2, meaning two turns owed. The card-count badge stays the count. The attacker does not draw. The 30 second timer moves to the new seat.

`ek-attack` is that handoff. Mira is active, her status is x2, and Ash has no Draw button.

### The Nope window

The window is the room's 5 second quick deadline, not a second clock inside the table. The badge reads 5 and the label reads NOPE.

The seat who must answer gets two buttons, Nope and Pass. Do not reuse the turn's raise-then-Play flow here. Five seconds is too short for a two-step gesture. A seat with no Nope is not in the queue, sees the same countdown, and gets no buttons.

A timeout plays pass. It does not add a miss and does not call the policy. The room already does that.

`ek-nope` is Ash answering an Attack, with Nope outlined in hand so the card they would spend is visible.

### What the other seats see when someone explodes

The kitten and the dead hand are public. The `Exploded` event carries that hand. Other seats see those faces and the word OUT. They do not see a defuse index, because there was no defuse. On the next paint the row may empty. The mock keeps the faces up so the beat is readable in a still.

`ek-explode` is Ash's view of Mira's dead hand. The turn has already moved, so Ash has Draw and a 30 second badge. A dead seat is skipped.

### What the other seats see when someone defuses

The Defuse and the kitten are public for the beat. There is no plant digit. Other seats do not learn the index. Their `knownTop` stays empty and `plantedIndex` stays null, which is the rule already. The hand stays backs. The count drops by the Defuse that was played. The kitten returns to the pile as a back after the beat. The planter's own screen may show the index. This mock is everyone else's screen.

`ek-defuse` shows the kitten face between the pile and the Defuse, Nova's count at 7, and no digit on the pile.

### Turn handoff

The active border moves to the next living seat. Buttons render only for the seat that is `toAct`. Everyone else watches the same 30 second badge. A dead seat is skipped. Attack skips the draw and hands the next seat the x2 status above. An ordinary play, such as Skip, leaves the next seat at one ordinary turn, so the status does not read x2.

`ek-turn` is the ordinary handoff. Skip is on the discard, Ash has Draw, and the badge reads 30.

## What Blackjack still teaches

Blackjack is not a room game. `beginMatch` rejects `economy: 'chips'` when the kind is `room`. Solo stays one human, id `player`, plus the dealer, and it stays a chips game. This spec does not change that table.

A later pull request teaches the room the pieces below. It still must not open a socket, arm an alarm, or draw an eye counter.

`seats` is `{ min: 2, max: 2 }` today because the dealer counts as a seat. Recommend `{ min: 2, max: 5 }`. The minimum still fits solo, one player and the dealer. The maximum fits four playing seats plus the dealer. Playing ids in a room are `s0` onward. The dealer id stays `dealer`, and the dealer remains house. The table reads seats from the frame. It does not hardcode `player`.

`setup` deals one face-up hand to each playing seat and one shared dealer hand. `opening` is the deal. `toAct` is null until the first decision, the same shape Flip 7 uses so a CPU cannot deal. `settle` returns point deltas. Solo `settle` stays chips.

### One shared dealer

Use one table and one dealer. Blackjack hands are public after the deal, except the hole card. Friends are there to see each other bust. A separate table for each seat would hide those hands and draw the dealer four times.

The hole card is one back on every view, including a spectator. No seat gets a peek. There is no insurance prompt in this version.

`bj-table` is that table. Four playing seats, one dealer, the hole card face down, Ash to act.

### Four seats

The column matches the Flip 7 room, not the solo blackjack side panels. Those panels are the chip rack and the hand history. This version has neither.

On a phone the dealer sits under the room bar, the other seats stack, your hand sits above the buttons. On a desktop the other seats share one row, the dealer is centered, and your hand is centered. The buttons stay on the bottom edge. `bj-table` shows both, at 390 by 844, 360 by 640, 1280 by 800, and 1440 by 900.

Each playing seat shows a nickname, a room score such as +1 or -1, the hand, and the hand total. The score and the total are different numbers. The HUD score is yours, with no dollar sign.

### Points, not a wallet

Keep score only. Do not add play money.

Play money would be a wallet, a zero balance, and a refill. The wire has no chip command, and `beginMatch` already refuses a chips room. A friend table does not need a bank. Flip 7 and Exploding Kittens already score in the same pill.

The stake is one point per hand, fixed. The host's Deal starts the hand. There is no bet ladder and no chip sprite. A seat that does not want the hand leaves or watches. Those commands already exist.

Settlement, in points, for each hand:

- A win adds 1. A loss subtracts 1. A push adds 0.
- A blackjack adds 2.
- A double doubles those numbers. A double win adds 2. A double loss subtracts 2.
- A split settles each hand on its own.

`bj-bet` is the moment before Deal. The middle reads "1 point each". The host sees Deal in the room bar. Nobody sees a chip rack.

### A split

A split stays one seat. The seat shows two hands. The hand that is finished dims. The hand that can still act has the pink border. Other seats see both hands face up, because blackjack hands are public. The seat does not become two chairs, and it does not take two turns in the room order.

The seat finishes the first hand, then the second. `toAct` stays on that seat. `schedule` already starts a fresh 30 second deadline when that human is still the one to act, so each hit, stand, or double gets its own 30 seconds. The game does not store a second timer.

On a phone the two hands stack, so both fit at 360 by 640. On a desktop they sit side by side.

`bj-split` is Ash's second hand, total 8, beside a stood 19. Hit, Stand, and Double are the buttons. The badge reads 30.

### Turn order

Playing seats act in list order, `s0`, then `s1`, then `s2`, then `s3`. The dealer acts last and has no timer. Rematch already rotates who is `s0`. The table follows `toAct` from the view. It does not assume the human id is `player`, and it does not let the dealer take a 30 second turn.

Buttons render only for the acting seat. `bj-table` is Ash's turn, so Ash has Hit, Stand, and Double, and the other seats do not. The 30 second badge is the room deadline, same pill as Exploding Kittens, with the label TURN.

A timeout plays `autoAct` at the room's filler difficulty. The first miss leaves the chair human. The second miss is the CPU takeover the room already has. Blackjack does not invent a softer timeout.

## Questions

Each question has one recommended answer.

- One shared dealer, or a table for each seat? One shared dealer. The hands are public, and one hole card is the shoe the room shares.
- Score only, or play money? Score only. Play money needs a wallet the room refuses to start.
- Does anyone pick a stake? No. Every hand is 1 point. The host Deal starts it. Double and split change the points, so those choices stay.
- Where do four seats sit? In the Flip 7 column. Phone stacks the other seats. Desktop puts them in one row. The dealer is house, in the middle, and is not a fifth player chip.
- Do the solo side panels stay? No. They hold the chip rack and the history. The room has neither.
- How many seats can the rules declare? `seats.max` becomes 5, counting the dealer, so four friends fit. `seats.min` stays 2, so solo still fits.
- Does solo blackjack change? No. Solo stays chips, id `player`, one human, and the dealer.
- What do Exploding Kittens opponents show? At most four backs, and a badge with the full count. Faces stay private.
- Who picks the card on a Favor between humans? The target, when they hold two or more cards. Only they see the faces. A pair steal does not ask the victim. The card is random, and only the thief's view gains the face.
- What do other seats see on an explosion? The kitten and the dead hand, then OUT. The hand is public because the event carries it.
- What do other seats see on a defuse? The Defuse, the kitten face for that beat, and no index. The hand stays hidden.
- How does a player answer Nope? With Nope and Pass, inside the room's 5 second window. A timeout passes and does not add a miss.
- Does a chosen card lift off the hand? No. It takes a pink outline. A lift covers the discard on a short phone.
- Does the table run a clock? No. It paints `frame.deadline`. The room alarm is the timeout.
- What does a spectator see? The eye counter stays on the shell. An Exploding Kittens watcher sees counts and the discard, and no hand. A blackjack spectator sees every upcard and the same hole back as a seated player.
- When does the 30 second timer restart on a split? After each action, while that human is still `toAct`. The room's `schedule` already does this. The second hand does not inherit a dying clock.
- Who acts, and in what order? `s0`, then `s1`, then `s2`, then `s3`, then the dealer. Buttons exist only for the acting seat. The dealer has no timer.

## Mocks

The prototype composes the existing neon pieces. Exploding Kittens uses `ekFace`. Blackjack uses `standardFaceRenderer`. Seats use `SeatCaption`, so a CPU still gets the bot. The room chips, the score pill, and the eye counter are the shell's, with the score drawn as a bare number so it does not go through `formatMoney`.

| Scene | What it shows |
| --- | --- |
| `ek-hands` | Backs, counts, your faces, the bot |
| `ek-favor` | Favor raised, every other seat pickable |
| `ek-give` | The human who must give a card |
| `ek-steal` | A pair aimed at one human |
| `ek-attack` | The next seat owes two turns |
| `ek-nope` | The 5 second window, Nope and Pass |
| `ek-explode` | Another seat's dead hand |
| `ek-defuse` | A public kitten and no index |
| `ek-turn` | An ordinary handoff and a 30 second badge |
| `bj-table` | One dealer, four seats, your turn |
| `bj-bet` | 1 point each, host Deal, no chips |
| `bj-split` | Two hands on one seat, 30 seconds |

Each scene is shot at 390 by 844, 360 by 640, 1280 by 800, and 1440 by 900. The file name is the scene, a hyphen, and the width, for example `ek-nope-390.png` and `bj-split-1440.png`.

`node docs/multiplayer/ux/layout-check.mjs` serves the preview, writes those files, and fails if any `data-region` is off the viewport, clipped by its own box, or overlapping a region it does not contain. A title whose ink crosses the card face fails too, and so does a name that shares a row with a stacked hand. The `ux-layout` CI job runs that script. A region that contains another region is allowed. Two cards in one row are not allowed to overlap.
