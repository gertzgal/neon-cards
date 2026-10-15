# Multi-seat play (dev game High Card)

The Flip 7 readiness path in the real app, without Flip 7 rules. `/games/high-card` serves the engine's test-only High Card game (1 human + 1 to 3 CPUs) on any stack with `DEV_RIG=1` (`pnpm dev`, `pnpm start`, e2e, verify). It opens the pre-game sheet built from `meta.settings` (opponents, difficulty, seat), sends the choice as `config`, and the Worker builds the seats with the roster. CPU seats act on the server; their turns come back as `turn` events plus normal events, and the table plays them paced (a THINKING beat per CPU, tap to skip) before handing the turn back. The top zone is the kit's `OpponentRows`: slim stacked rows on phone, side by side on desktop. The lobby never lists the game, and a deployed Worker answers 404 for it.

## Sub-features

- `pregame`: one `pregame-<key>` control per setting (`pregame-opponents`, `pregame-difficulty`, `pregame-position`) with buttons `pregame-<key>-<value>`, then `pregame-play`. The choice is remembered under `neon-cards:game-settings:high-card`.
- `high-card-table` carries `data-phase` (`playing`, `settling`, `over`), `data-playing` (playback running), `data-acting` (the seat whose turn is playing), and `data-settled`.
- `opponent-rows` (`data-count`) holds `seat-cpu-N` with a `[data-difficulty]` pip, `seat-cpu-N-hand`, `seat-cpu-N-total` (score), and `seat-cpu-N-status` (`THINKING`, `KEEP`, `SWAP`, `WIN`).
- `round-status` reads `YOUR TURN`, `ROUND n`, `ROUND WON`, `ROUND LOST`, `YOU WIN`, or `GAME OVER`. Actions are `action-keep`, `action-swap`, and `action-next` between rounds. Three rounds make a game.
- Each finished round lands in `GET /api/history?gameId=high-card` (score game, `net` 0, no wallet).

## How to get to it (user POV)

- Open `http://localhost:$PORT/games/high-card`, pick settings, tap Play.

## Driving it with verify.sh

Preconditions:

- `pnpm verify doctor` passes.

- **Settings sheet.** `pnpm verify drive --path /games/high-card --click pregame-opponents-3 --click pregame-difficulty-hard --click pregame-play --expect "opponent-rows" --expect seat-cpu-3`.
- **Full flow** (CPU turns before the human, paced beats, round end, history, resume, remembered settings): `BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/shell-multiseat.spec.ts`.

## Gotchas

- Without `DEV_RIG=1` the session create is a 404 and the shell shows `game-error`.
- With `position: last` the CPUs act inside the `POST /api/sessions` response, so their beats play as soon as the table mounts; wait on `round-status=YOUR TURN` before acting.
- The table syncs to the server view only after playback ends; assert on `data-settled="true"` or `round-status`, not mid-playback DOM.
