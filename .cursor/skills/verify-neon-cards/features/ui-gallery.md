# UI kit gallery

`/ui-gallery.html` renders the `@neon-cards/ui` primitives on the real stack with fixed sample data, so a change to the kit can be proven visually at phone and desktop sizes before any game uses it. It has no API calls and no state beyond the betting scene's local pot.

## Sub-features

- `gallery-table` (`?scene=table`): the mock's composition. HUD bankroll, dealer tray with one face-down card, pot, the human's fan with its total badge, HIT/STAND/DOUBLE/SPLIT on the felt arc.
- `gallery-betting` (`?scene=betting`): empty tray print, pot, chip rack plus clear and deal. Chip taps add to the pot and count the bankroll down.
- `gallery-opponents` (`?scene=opponents&n=1|2|3`): Flip 7 faces in 1 to 3 CPU seats (`seat-cpu1..3`), stacked rows on phone, side by side on desktop. `cpu1` holds the active glow.
- `gallery-juice` (`?scene=juice`): press DEAL to play a scripted round through `useBatchPlayback`. Deals fly in, ADA (`cpu1`) and BIX (`cpu2`) each get a THINKING beat, ADA busts (shake and flash on its seat), the hole card flips, and the win pops `+$50` with chips flying to the player. `juice-demo` carries `data-playing` and `data-acting`. A tap anywhere while playing skips to the end. DEAL also starts the synthwave loop, and the HUD sound icon mutes the shared audio manager.
- `gallery-sheet` (`?scene=sheet`): both decks (standard 52 and Flip 7), the card back, chips and a grouped pot, badge states, buttons, and a segmented control.

## How to get to it (user POV)

- Open `http://localhost:$PORT/ui-gallery.html?scene=<scene>`.

## Driving it with verify.sh

Preconditions:

- `pnpm verify doctor` passes.

- **Screens.** Run `pnpm verify drive --path "/ui-gallery.html?scene=table" --expect "hud-bankroll=\$1,250" --expect "player-total=16"`, then compare `phone.png` and `desktop.png` with `docs/reference/gal-minimal-mock.png`.
- **Opponents.** Run `pnpm verify drive --path "/ui-gallery.html?scene=opponents&n=3" --expect seat-cpu3`.
- **Juice.** Open `?scene=juice`, click `action-deal`, and wait for `juice-demo[data-playing=false]`. Expect `seat-cpu1-status=BUST`, `seat-cpu2-status=STAND`, and an empty `fx-layer`.
- **Everything automated.** `BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/ui-gallery.spec.ts` covers the 3-seat Flip 7 table, both decks on the sheet, reduced-motion playback, and tappable action buttons. Paced CPU turns on the real shell are `e2e/shell-multiseat.spec.ts`. Lobby audio is `e2e/audio.spec.ts`.

## Gotchas

- The edge swirl animates on desktop and is static on phones and under reduced motion, so desktop screenshots differ run to run at the edges. Compare the middle of the table.
- Juice runs on the Web Animations API with fixed durations, so a mid-round screenshot is timing-dependent. Assert on the end state, or on `data-acting`.
- The sheet scene has no `table` test id; expect `gallery-sheet` instead.
