#!/usr/bin/env bash
# Manual deploy, the same steps Cloudflare Workers Builds runs on push to main.
# Builds runs `pnpm run build` at the repo root, then:
#   cd apps/worker && pnpm exec wrangler d1 migrations apply DB --remote && pnpm exec wrangler deploy
# Needs `wrangler login` or CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID when the
# token can see more than one account). The database id lives in apps/worker/wrangler.toml.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
pnpm build
cd "$root/apps/worker"
pnpm exec wrangler d1 migrations apply DB --remote
pnpm exec wrangler deploy
