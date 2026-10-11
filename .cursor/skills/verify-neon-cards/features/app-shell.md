# App shell: lobby, HUD, settings, history, routing

Every screen sits inside the UI kit stage (`neon-root`, with `stage`, the edge swirl, and `crt-overlay`). Opening Neon Cards shows the lobby: the neon logo, one tile per game in `apps/web/src/games.ts`, the kit bankroll pill at the top left (from `GET /api/wallet`), and the history, sound, and settings icons at the top right. The gear opens the settings sheet (music, effects, motion), the speaker mutes everything, and both persist in localStorage. `/history` lists finished rounds from `GET /api/history`: the outcome and hand (from the plugin's optional `recap`), the net, and a short relative time. The game filter appears only once more than one game is listed. Every non-API path serves the app; unknown pages and games show a way back to the lobby.

## Sub-features

- `shell-lobby` lists every registered game as `game-<id>`, a tile with only the game's title; with no games it shows `game-list-empty`.
- `shell-wallet` is the kit `hud-bankroll` pill with `data-value` (balance) and text like `$1,250`. It is absent while the wallet is loading or unreachable.
- `shell-settings` opens `settings` from `hud-settings`; toggles are `setting-music`, `setting-sfx`, `setting-motion` with `data-value` and one button per option (`setting-music-off`, `setting-motion-reduced`). Motion resolves onto `<html data-motion="full|reduced">`.
- `shell-mute` is `hud-sound` with `aria-pressed` `true` when muted. It also drives the kit audio manager (`getAudio()`).
- `shell-music`: the synthwave loop starts on the first tap or key press anywhere and plays only while Music is on, sound is unmuted, and the tab is visible. Audio has no DOM, so `e2e/audio.spec.ts` counts `OscillatorNode` starts over a second of idle lobby: 0 AudioContexts before the first gesture, more than 5 notes a second while the loop plays, and exactly 0 with Music off (also after a reload) or muted.
- `shell-history` is `/history` (`history-list`, `history-round` with `history-outcome`, `history-hands`, `history-net`, and `history-empty`). The filters `history-all` and `history-filter-<id>` render only with more than one listed game, and a row names its game only when the list mixes games.
- `shell-table-hud`: over a live table the shell draws no HUD of its own; `hud-sound` and `hud-settings` render inside the table's top bar, and the settings sheet adds `table-history`, `table-lobby`, and `new-game`.
- `shell-play`: `/games/<id>` creates a session (`POST /api/sessions`) or resumes the stored one, mounts the game's table, and posts each action with the server's last `seq`; chips games push the returned wallet into the HUD pill. `?rig=<name>` and `?seed=<n>` on the game URL go into `config` for a Worker with `DEV_RIG=1` and always start a fresh session.
- `shell-pregame`: a game with `meta.settings` opens `pregame` before a new session, with one `pregame-<key>` segmented control per setting (`data-value`, buttons `pregame-<key>-<value>`) and `pregame-play`. The choice is remembered per game under `neon-cards:game-settings:<id>`. Blackjack has no settings and deals straight in; Flip 7 and the dev game at `/games/high-card` shows it (see `multi-seat.md`).
- `shell-routing` covers `nav-back`, `nav-history`, `not-found`, and `go-home`.

## How to get to it (user POV)

- Open `http://localhost:$PORT/`.
- Tap the gear, the speaker, or the history icon in the HUD.
- Open a deep link such as `/history?game=<id>` or `/games/<id>`.

## Driving it with verify.sh

Preconditions:

- `scripts/verify.sh doctor` passes.

- **Lobby.** `scripts/verify.sh drive --expect "app-title=Neon Cards" --expect hud-bankroll --expect game-list`. Screenshots show the logo, wallet pill, and icons.
- **Settings.** `scripts/verify.sh drive --click hud-settings --click setting-music-off --expect "settings=Settings"`. `report.json` lists `setting-music` with `data-value` `off`.
- **History.** `scripts/verify.sh drive --path /history --expect history-list`.
- **Not found.** `scripts/verify.sh drive --path /games/nope --expect "not-found=No game called"`.
- **Blackjack round.** `scripts/verify.sh drive --path "/games/blackjack?rig=win" --click chip-25 --click action-deal --expect "hand-0-total=19"`. Every moment (stand, settle, wallet, history, resume) is `e2e/blackjack.spec.ts`.
- Full flows (persistence across reload, back navigation) are in `e2e/shell.spec.ts`: `BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/shell.spec.ts`.

## Gotchas

- A pointer-down anywhere or any key while the Blackjack table plays a batch (`data-busy="true"` after the response arrives) skips to the end of that batch. To screenshot a mid-round moment, don't click or press keys until it's on screen.
- A `?rig=` URL never resumes; open `/games/<id>` without it to test resume.

- `hud-bankroll` only appears once `GET /api/wallet` answers. Wait for it rather than asserting on first paint. On the blackjack table it shows the same balance as the lobby and as `GET /api/wallet`: chips on the felt and a wager in play stay inside that number until the round settles.
- Settings live in localStorage under `neon-cards:settings`; a fresh Playwright context starts from defaults.
- A stale stack serves an old bundle. Doctor catches it; restart after web changes.
