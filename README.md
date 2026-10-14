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

Pushing to `main` deploys through Cloudflare Workers Builds. The build command is `pnpm run build` at the repo root. The deploy command applies remote D1 migrations and deploys the Worker:

```sh
cd apps/worker && pnpm exec wrangler d1 migrations apply DB --remote && pnpm exec wrangler deploy
```

`apps/worker/wrangler.toml` points at the production D1 database `neon-cards`. Local dev (`pnpm dev`, `pnpm start`, `wrangler dev --local`) uses a local D1 and does not touch that database. Production never sets `DEV_RIG`.

The same steps, for a manual deploy from a logged-in machine:

```sh
pnpm --filter @neon-cards/worker exec wrangler login   # or export CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID)
pnpm run deploy
```

GitHub Actions does not deploy.
