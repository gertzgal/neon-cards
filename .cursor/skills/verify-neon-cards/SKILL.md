---
name: verify-neon-cards
description: Start the Neon Cards stack (Hono Worker + local D1 via wrangler dev, serving the built Vite app) and drive the real web UI with Playwright on phone and desktop to prove a change. Use before merging any PR that touches apps/, packages/, or e2e/, or whenever you need screenshots or DOM evidence of the running app.
---

# Verify Neon Cards

Neon Cards is a browser game. The user touches the web UI; the UI talks to `/api/*` on the same Worker, which reads and writes D1. Prove changes on that real path: the built app served by `wrangler dev` with a fresh local D1, driven by Playwright at phone (390x844) and desktop (1440x900).

Read `features/README.md` for the feature map, then the feature file you're proving.

## Launch

```sh
.cursor/skills/verify-neon-cards/scripts/verify.sh start
```

It builds `apps/web`, wipes and migrates a private local D1 (`apps/worker/.wrangler/verify-$PORT`), and starts `wrangler dev` in its own process group on `PORT` (default `8790`, so it never collides with `pnpm dev` on 8787/5173). It's ready when it prints `[verify:8790] OK pgid=... health={"ok":true,...}`. It refuses to start if the port is held by something it didn't start; pick another with `PORT=8791`.

It runs on Linux and macOS: the stack gets its own session from util-linux `setsid` where it exists, and from perl's `POSIX::setsid` on macOS, which has no `setsid`. `pnpm verify <cmd>` is the same launcher, and is what the feature files use.

Run `pnpm i` first on a fresh checkout. Playwright's Chromium must be installed (`pnpm exec playwright install chromium`).

## Doctor

```sh
.cursor/skills/verify-neon-cards/scripts/verify.sh doctor
```

Read-only. Passes only when the process group this script started is alive, `/api/health` returns `ok: true` (D1 answered from the migrated schema), and the served JS bundle matches `apps/web/dist/index.html` (the stack is running your current build). After changing web code, `stop` and `start` again; doctor reports `stale stack` otherwise.

## Drive

```sh
.cursor/skills/verify-neon-cards/scripts/verify.sh drive \
  --path / \
  --click <testid> \
  --expect "app-title=Neon Cards" \
  --expect "db-status=D1 ok · schema foundation"
```

`scripts/drive.mjs` opens `--path` at both viewports (limit with `--viewport phone` or `--viewport desktop`), screenshots before, clicks each `--click` test id in order, then checks each `--expect testid=text` (text is a substring match; `--expect testid` alone just requires visibility). It fails on any missed expectation or browser console error. Handles are `data-testid` attributes; every element a test touches must have one.

For a multi-step flow (a full blackjack round), write a Playwright spec under `e2e/` and run it against the running stack instead:

```sh
BASE_URL=http://localhost:8790 pnpm exec playwright test e2e/<spec>.spec.ts
```

One command for the whole loop (start, doctor, drive, stop, keeping evidence):

```sh
pnpm verify all --expect "app-title=Neon Cards"
```

## Evidence

Each run writes to `artifacts/verify/<UTC timestamp>/` (override with `EVIDENCE_DIR`): `phone-before.png`, `phone.png`, `desktop-before.png`, `desktop.png`, `report.json` (every `data-testid` on the page with its text and `data-state`, HTTP status, console errors, failures), and `stack.log` (copied at stop). `artifacts/` is gitignored; attach screenshots to the PR when they prove a visual claim.

Proof standards:
- Drive the real user path through the UI. Don't call internal setters, and don't seed state the user couldn't create. Dev rigging (`config.rig` with `DEV_RIG=1`) is the one sanctioned exception for forcing a specific deal.
- Capture the action and the resulting state, not only the final screen.
- Check side effects too: after a mutation, read them back through a second view (reload the page, or `curl http://localhost:$PORT/api/...`).
- A green `pnpm e2e` in CI is necessary, not sufficient. Look at the screenshots.

## Cleanup

```sh
.cursor/skills/verify-neon-cards/scripts/verify.sh stop
```

Kills only the process group `start` recorded, copies `stack.log` into the evidence folder, and deletes the private D1 and `/tmp/neon-verify-$PORT`. Evidence stays. `all` runs `stop` on exit, pass or fail. Never kill `wrangler` or `workerd` by name: another agent's stack may be running.

## Helpers

- `scripts/verify.sh [all|start|doctor|drive|stop] [drive args]`: the launcher above. Env: `PORT`, `EVIDENCE_DIR`.
- `scripts/drive.mjs --url <base> --out <dir> [--path] [--click]... [--expect]... [--viewport]...`: the Playwright driver; `verify.sh drive` fills in `--url` and `--out`.

Keep `features/` current: when you ship a user-facing feature, add or update its file in the same PR.
