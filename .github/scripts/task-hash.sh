#!/usr/bin/env bash
# Content hash of one CI task's inputs. Tracked blobs only, so node_modules never counts.
set -euo pipefail
task=${1:?task name}
cd "$(git rev-parse --show-toplevel)"

trees() {
  local args=() p
  for p in "$@"; do
    args+=("HEAD:$p")
  done
  git rev-parse "${args[@]}"
}

case "$task" in
  lint)
    git ls-files -s -- ':(glob)**/*.ts' ':(glob)**/*.tsx' ':(glob)**/*.js' ':(glob)**/*.mjs' eslint.config.js package.json
    ;;
  typecheck)
    {
      git ls-files -s -- ':(glob)**/*.ts' ':(glob)**/*.tsx' ':(glob)**/tsconfig.json' ':(glob)**/tsconfig.*.json' tsconfig.base.json
      trees package.json pnpm-lock.yaml pnpm-workspace.yaml
    }
    ;;
  unit)
    trees apps packages vitest.config.ts package.json pnpm-lock.yaml pnpm-workspace.yaml
    ;;
  e2e)
    trees apps packages e2e playwright.config.ts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json .github/workflows/ci.yml .github/scripts .github/actions
    ;;
  webdist)
    trees apps/web packages package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json
    ;;
  *)
    echo "unknown task: $task" >&2
    exit 2
    ;;
esac | sha256sum | awk '{print $1}'
