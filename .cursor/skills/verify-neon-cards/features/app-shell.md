# App shell: lobby, HUD, settings, history, routing

Opening Neon Cards shows the lobby: the neon logo, one tile per game in `apps/web/src/games.ts`, the wallet pill at the top left (from `GET /api/wallet`), and the history, sound, and settings icons at the top right. The gear opens the settings sheet (music, effects, motion), the speaker mutes everything, and both persist in localStorage. `/history` lists finished rounds from `GET /api/history`, filterable by game. Every non-API path serves the app; unknown pages and games show a way back to the lobby.

## Sub-features

- `shell-lobby` lists every registered game as `game-<id>`; with no games it shows `game-list-empty`.
- `shell-wallet` shows `wallet` with `data-state` `loading`, `ok` (balance like `$1,250`), or `error` (`$—`).
- `shell-settings` opens `settings` from `open-settings`; toggles are `setting-music`, `setting-sfx`, `setting-motion` with `data-value` and one button per option (`setting-music-off`, `setting-motion-reduced`). Motion resolves onto `<html data-motion="full|reduced">`.
- `shell-mute` is `sound-toggle` with `data-state` `on` or `muted`.
- `shell-history` is `/history` (`history-list`, `history-round`, `history-empty`, filters `history-all` and `history-filter-<id>`).
- `shell-table-hud`: over a live table the shell draws no HUD of its own; `sound-toggle` and `open-settings` render inside the table's top bar, and the settings sheet adds `table-history`, `table-lobby`, and `new-game`.
- `shell-routing` covers `nav-back`, `nav-history`, `not-found`, and `go-home`.

## How to get to it (user POV)

- Open `http://localhost:$PORT/`.
- Tap the gear, the speaker, or the history icon in the HUD.
- Open a deep link such as `/history?game=<id>` or `/games/<id>`.

## Driving it with verify.sh

Preconditions:

- `scripts/verify.sh doctor` passes.

- **Lobby.** `scripts/verify.sh drive --expect "app-title=Neon Cards" --expect wallet --expect game-list`. Screenshots show the logo, wallet pill, and icons.
- **Settings.** `scripts/verify.sh drive --click open-settings --click setting-music-off --expect "settings=Settings"`. `report.json` lists `setting-music` with `data-value` `off`.
- **History.** `scripts/verify.sh drive --path /history --expect history-list`.
- **Not found.** `scripts/verify.sh drive --path /games/nope --expect "not-found=No game called"`.
- Full flows (persistence across reload, back navigation) are in `e2e/shell.spec.ts`: `BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/shell.spec.ts`.

## Gotchas

- `wallet` starts as `loading`. Assert on the settled state.
- Settings live in localStorage under `neon-cards:settings`; a fresh Playwright context starts from defaults.
- A stale stack serves an old bundle. Doctor catches it; restart after web changes.
