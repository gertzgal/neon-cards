#!/bin/bash
# Cloud-session setup: install the workspace and make Playwright's Chromium
# resolvable so `pnpm e2e` and `pnpm verify` run. Only runs in Claude Code cloud.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

pnpm install

# The container ships Chromium in /opt/pw-browsers, but its build can lag the
# revision the pinned @playwright/test expects, and the Playwright CDN is not
# reachable. Build .playwright-browsers (gitignored, same dir CI uses) with the
# expected revision names linked to the newest preinstalled build.
SYSTEM_BROWSERS=/opt/pw-browsers
LOCAL_BROWSERS="$CLAUDE_PROJECT_DIR/.playwright-browsers"

if [ -d "$SYSTEM_BROWSERS" ]; then
  core=$(node -p "require('path').dirname(require.resolve('playwright-core/package.json', { paths: [require.resolve('@playwright/test')] }))")
  want() { node -p "require('$core/browsers.json').browsers.find((b) => b.name === '$1').revision"; }
  newest() { ls -d "$SYSTEM_BROWSERS"/"$1"-[0-9]* 2>/dev/null | sort -t- -k2 -n | tail -1; }

  # link <name> <dir in expected layout> <exe expected> <exe in system build>
  link() {
    local name=$1 dir=$2 exe=$3 sysexe=$4
    local rev src dest
    rev=$(want "$name")
    dest="$LOCAL_BROWSERS/${name//-/_}-$rev"
    [ -e "$dest/$dir/$exe" ] && return 0
    if [ -d "$SYSTEM_BROWSERS/${name//-/_}-$rev" ]; then
      ln -sfn "$SYSTEM_BROWSERS/${name//-/_}-$rev" "$dest"
      return 0
    fi
    src=$(newest "${name//-/_}")
    [ -n "$src" ] || { echo "session-start: no preinstalled ${name} in $SYSTEM_BROWSERS" >&2; return 0; }
    local srcdir
    srcdir=$(dirname "$(ls "$src"/*/"$sysexe" | head -1)")
    rm -rf "$dest"
    mkdir -p "$dest/$dir"
    for f in "$srcdir"/*; do ln -sfn "$f" "$dest/$dir/"; done
    ln -sfn "$srcdir/$sysexe" "$dest/$dir/$exe"
    touch "$dest/INSTALLATION_COMPLETE" "$dest/DEPENDENCIES_VALIDATED"
    echo "session-start: linked $(basename "$src") as $(basename "$dest")"
  }

  mkdir -p "$LOCAL_BROWSERS"
  link chromium chrome-linux64 chrome chrome
  link chromium-headless-shell chrome-headless-shell-linux64 chrome-headless-shell headless_shell
  for f in "$SYSTEM_BROWSERS"/ffmpeg-*; do [ -e "$f" ] && ln -sfn "$f" "$LOCAL_BROWSERS/"; done

  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PLAYWRIGHT_BROWSERS_PATH=\"$LOCAL_BROWSERS\"" >> "$CLAUDE_ENV_FILE"
  fi
fi
