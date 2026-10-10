# Health API

`GET /api/health` reports whether the Worker can read its D1 database. It returns `{"ok":true,"db":{"schema":"foundation"}}` when the migrations have run, and a 503 with `ok: false` otherwise. Unknown `/api/*` paths return 404 instead of the app.

## Sub-features

- `health-ok` returns 200 with the schema row.
- `api-404` returns 404 for unknown API routes.

## How to get to it (user POV)

- The app calls it on load (see [app-shell.md](app-shell.md)).
- `curl http://localhost:$PORT/api/health`.

## Driving it with verify.sh

Preconditions:

- `scripts/verify.sh doctor` passes (doctor already calls this endpoint).

- **Health.** Run `curl -s http://localhost:$PORT/api/health`. Output is exactly `{"ok":true,"db":{"schema":"foundation"}}`.
- **API 404.** Run `curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/nope`. Output is `404`.

## Gotchas

- The Worker only runs first for `/api/*` (`run_worker_first` in `wrangler.toml`). Every other path is a static asset or the SPA fallback, so a new API route must live under `/api`.
