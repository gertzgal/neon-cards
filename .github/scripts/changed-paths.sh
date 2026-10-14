#!/usr/bin/env bash
# Path filter for a pull request. Prints lint/typecheck/unit/e2e=true|false.
# Push (main) and any uncertainty run the full suite.
set -euo pipefail

out() { echo "$1=$2" >> "${GITHUB_OUTPUT:?}"; }

run_all() {
  out lint true
  out typecheck true
  out unit true
  out e2e true
}

if [[ "${GITHUB_EVENT_NAME:-}" != "pull_request" ]]; then
  run_all
  exit 0
fi

base="${PR_BASE_SHA:?}"
if ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  git fetch --no-tags --depth=1 origin "$base" || {
    echo "could not fetch $base; running every task" >&2
    run_all
    exit 0
  }
fi
files=$(git diff --name-only "$base" HEAD || true)
if [[ -z "$files" ]]; then
  run_all
  exit 0
fi

lint=false
typecheck=false
unit=false
e2e=false

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    docs/*|*.md|.gitattributes|.gitignore|LICENSE)
      ;;
    e2e/*|playwright.config.ts)
      lint=true
      typecheck=true
      e2e=true
      ;;
    *)
      lint=true
      typecheck=true
      unit=true
      e2e=true
      ;;
  esac
done <<< "$files"

out lint "$lint"
out typecheck "$typecheck"
out unit "$unit"
out e2e "$e2e"
