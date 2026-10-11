# neon-cards

Neon pixel card-game platform. Blackjack first, Flip 7 next.

One Cloudflare Worker (Hono) serves the API under `/api` and the Vite + React app as static assets, backed by D1. Everything runs locally with no Cloudflare account.

## Run it

```sh
pnpm i
pnpm dev        # http://localhost:5173 (Vite, hot reload) -> Worker + local D1 on :8787
```

Other commands are in [AGENTS.md](AGENTS.md#commands). Requires Node 22 and pnpm 10.

## Layout

- `apps/worker`: Hono API, static asset serving, D1 migrations, `wrangler.toml`.
- `apps/web`: the Vite React shell.
- `packages/engine`: game-agnostic core (pure TS).
- `packages/ui`: shared UX kit.
- `packages/games/*`: one package per game.
- `docs/`: the [architecture contract](docs/architecture.md), [plan](docs/plan.md), [decisions](docs/decisions.md), [look and feel](docs/look-and-feel-brief.md), and reference assets.

## Deploy

Deploy is one command once you're logged in to Cloudflare:

```sh
pnpm --filter @neon-cards/worker exec wrangler login   # or export CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID)
pnpm run deploy
```

`pnpm run deploy` (`scripts/deploy.sh`) builds the web app, finds or creates the `neon-cards` D1 database, applies the remote migrations, and deploys the Worker. `apps/worker/wrangler.toml` keeps a placeholder database id for local dev; the script deploys from a generated copy with the real id, so no tracked file changes. Production never sets `DEV_RIG`.

CI deploys automatically: the `deploy` job runs after `checks` and `e2e` on every push to `main` when the repository has a `CLOUDFLARE_API_TOKEN` secret (optionally `CLOUDFLARE_ACCOUNT_ID`). On every run it reports whether the secret is present, never its value.
