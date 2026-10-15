# How to play

The first time a table mounts, a full-page guide opens over it. The book in the top bar, directly left of mute, opens it again. Closing with the X, GOT IT, or Escape writes `neon-cards:guide-seen:<gameId>` in this browser, so a refresh stays on the felt. The lobby has no book. The page is the game's `guide` document: prose, then felt cards where that game supplied them. The shell does not pick sentences or faces.

## Sub-features

- `guide-first` is `guide` visible on the first visit to `/games/<id>` once the table is playing. Flip 7 and Exploding Kittens show `pregame` first.
- `guide-close` is `guide-close`, `guide-done`, or Escape. Each hides `guide` and clears `inert` on `neon-root`.
- `guide-book` is `hud-guide`, an icon button left of `hud-sound`, only while the table is up. It opens `guide` again and does not clear the seen key.
- `guide-return` is a reload after close: `game-screen` is `playing` and `guide` is absent until the book is clicked.
- `guide-copy` is `guide-section-<id>` and `guide-row-<id>` from the document. Blackjack rows are `ace`, `face`, `number`. Flip 7 includes `freeze`. Exploding Kittens includes `kitten`.

## How to get to it (user POV)

- Open a game. The page is already up on a first visit.
- Close it, then tap the book left of the speaker.
- Refresh. The felt is back, and the book is still there.

## Driving it with verify.sh

Preconditions:

- `scripts/verify.sh doctor` passes.
- This browser has not already stored `neon-cards:guide-seen:<gameId>`. A stack started by verify is a fresh origin, so the key is absent.

- **First open.** `scripts/verify.sh drive --path /games/blackjack --expect guide --expect guide-section-goal --expect guide-row-ace`.
- **Close.** Add `--click guide-done` and expect `hud-guide`. The guide test id is gone.
- **Book.** `--click hud-guide --expect guide`.
- Flip 7 and Exploding Kittens need `--click pregame-play` before the guide is up.
- Phone and desktop, and the reload that stays closed, are `e2e/guide.spec.ts`: `BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/guide.spec.ts`.

## Gotchas

- Existing specs mark the guide seen before load (`e2e/fixtures.ts`, `guideSeen`). A spec that wants the first visit sets `test.use({ guideSeen: false })`.
- While `guide` is open, `.nc-root` is `inert`. Clicks on the felt do nothing. The X and the footer are outside that root.
- Escape while the page is open closes it and does not hurry a deal. A key that is still down after close is ignored until it is released.
