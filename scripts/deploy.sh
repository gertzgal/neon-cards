#!/usr/bin/env bash
# One-command deploy to Cloudflare Workers: build the web app, find or create the remote D1 database,
# apply its migrations, and deploy the Worker. Needs `wrangler login` or CLOUDFLARE_API_TOKEN
# (plus CLOUDFLARE_ACCOUNT_ID when the token can see more than one account).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
worker="$root/apps/worker"
db_name="neon-cards"
placeholder="00000000-0000-0000-0000-000000000000"
wrangler() { (cd "$worker" && pnpm exec wrangler "$@"); }

cd "$root"
pnpm build

find_db() {
  wrangler d1 list --json | node -e '
    const name = process.argv[1]
    const dbs = JSON.parse(require("fs").readFileSync(0, "utf8"))
    process.stdout.write(dbs.find((db) => db.name === name)?.uuid ?? "")' "$db_name"
}

db_id="$(find_db)"
if [ -z "$db_id" ]; then
  echo "[deploy] creating D1 database $db_name"
  wrangler d1 create "$db_name" >/dev/null
  db_id="$(find_db)"
fi
[ -n "$db_id" ] || { echo "[deploy] could not resolve the D1 database id" >&2; exit 1; }
echo "[deploy] D1 $db_name = $db_id"

# wrangler.toml keeps the local placeholder id; the deploy runs from a generated copy next to it
# (gitignored) so relative paths still resolve and no tracked file changes.
config="$worker/wrangler.deploy.toml"
sed "s/$placeholder/$db_id/" "$worker/wrangler.toml" > "$config"
trap 'rm -f "$config"' EXIT

wrangler d1 migrations apply DB --remote --config wrangler.deploy.toml
wrangler deploy --config wrangler.deploy.toml
