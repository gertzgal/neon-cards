# Layout fit

Hand cards, slot rows, and action buttons stay on screen. A straight fit row does not cover its own cards. A slot tick does not cover the next tick. Hit, Stay, Draw, and the defuse row take their own clicks. The check opens the real tables in Chromium at 360×640, 390×844, 1280×800, and 1440×900.

## Sub-features

- `layout-ek-defuse` is an Exploding Kittens defuse: eight cards in `you-hand` and twenty-three `insert-*` slots, including Top and Bottom.
- `layout-flip7-hand` is a Flip 7 round at score 60: number cards in `you-hand`, modifier cards in `you-extras`, seven `slot-*` marks, and `action-hit` / `action-stay`.
- `layout-blackjack-hand` is a blackjack hand totaling `10/20`: player cards, the dealer hand, and Hit, Stand, Double, and Split.
- `layout-viewports` is the four sizes above. 360 and 390 use the phone composition. 1280 and 1440 use the desktop composition.

## How to get to it (user POV)

- Open Exploding Kittens, choose 3 opponents, press Play, close How to play, and draw into a kitten.
- Open Flip 7, press Play, close How to play, and hit until the round score reads 60.
- Open Blackjack, press Play, close How to play, add a 25 chip, deal, and hit until the total reads 10/20.
- Do that at a small phone (360×640), the usual phone (390×844), a short laptop (1280×800), and the usual desktop (1440×900).

## Driving it with verify.sh

Preconditions:

- `pnpm verify doctor` passes. `pnpm verify start` is what brings that stack up. `DEV_RIG=1` is already set on it.

- **All four sizes.** `pnpm verify layout`. The command plays the three tables above in Chromium and writes `layout.json` plus one screenshot per viewport and scene. Exit code 1 means a card, slot, or button is off the viewport, clipped by a scrolling ancestor, overlapping its row, or covered so the click lands elsewhere.
- **One scene by hand.** `pnpm verify drive` still screenshots phone 390×844 and desktop 1440×900 only. It does not measure boxes. Use `layout` for fit.

## Gotchas

- The layout browser sets reduced motion so the blackjack sway does not move a box during the measure. The tables, clicks, and server are the real app.
- A blackjack fan may overlap its own cards. Fit rows (Flip 7 and Exploding Kittens hands) may not. Buttons stay tappable where a card overlaps the felt: the check hits the button's own points.
- `action-card-*` is a card in the hand, not an action button. Insert slots are the defuse row, not the action bar.
- The first visit opens How to play. The script presses GOT IT before it measures. A stored guide flag in a reused browser skips that page.
- A rig URL needs the verify stack. A production worker rejects `?rig=`.
- `features/README.md` does not list this file yet. The open rooms PR is editing that index.
