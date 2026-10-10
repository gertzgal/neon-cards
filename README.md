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

Deploy is one command once a Cloudflare account is set up:

```sh
pnpm exec wrangler login                              # or export CLOUDFLARE_API_TOKEN
pnpm --filter @neon-cards/worker exec wrangler d1 create neon-cards
# paste the printed database_id into apps/worker/wrangler.toml
pnpm run deploy                                       # builds the web app, applies remote migrations, deploys the Worker
```
