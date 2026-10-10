# App shell boots and reads D1

Opening Neon Cards in a browser shows the neon title and a database status line. The status turns to `D1 ok · schema foundation` once the app has fetched `/api/health` from the same Worker, which proves the Worker serves the built app, the API answers, and the local D1 migrations ran.

## Sub-features

- `shell-boot` renders the app at `/`.
- `shell-db-status` shows the D1 status fetched from the API.
- `shell-deep-link` serves the app for any non-API path (SPA fallback).

## How to get to it (user POV)

- Open `http://localhost:$PORT/`.
- Open any deep link, for example `http://localhost:$PORT/games/blackjack`.

## Driving it with verify.sh

Preconditions:

- `scripts/verify.sh doctor` passes.

- **Boot.** Run `scripts/verify.sh drive --expect "app-title=Neon Cards"`. Both viewports show the title; `phone.png` and `desktop.png` show it centered on the near-black table.
- **DB status.** Run `scripts/verify.sh drive --expect "db-status=D1 ok · schema foundation"`. `report.json` lists `db-status` with `state: "ok"`.
- **Deep link.** Run `scripts/verify.sh drive --path /games/blackjack --expect app-title`. The title renders; the HTTP status in `report.json` is `200`.

## Gotchas

- `db-status` starts as `Checking database…` (`data-state="loading"`). Assert the final text, not the first paint.
- A stale stack serves an old bundle. Doctor catches it; restart after web changes.
