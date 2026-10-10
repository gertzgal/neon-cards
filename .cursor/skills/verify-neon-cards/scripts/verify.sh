#!/usr/bin/env bash
# Usage: verify.sh [all|start|doctor|drive|stop] [drive args...]
set -euo pipefail

ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PORT=${PORT:-8790}
URL="http://localhost:$PORT"
RUN_DIR="/tmp/neon-verify-$PORT"
PERSIST=".wrangler/verify-$PORT"
EVIDENCE_DIR_SET=${EVIDENCE_DIR:+1}
EVIDENCE_DIR=${EVIDENCE_DIR:-"$ROOT/artifacts/verify/$(date -u +%Y%m%dT%H%M%SZ)"}
SCRIPTS="$ROOT/.cursor/skills/verify-neon-cards/scripts"

log() { printf '[verify:%s] %s\n' "$PORT" "$*" >&2; }

[[ -f "$RUN_DIR/evidence" && -z "${EVIDENCE_DIR_SET:-}" ]] && EVIDENCE_DIR=$(cat "$RUN_DIR/evidence")

pgid() {
  local g
  g=$(cat "$RUN_DIR/pgid" 2>/dev/null || true)
  # Never hand back our own process group: signalling it would kill the caller.
  [[ -n "$g" && "$g" != "$(ps -o pgid= -p $$ | tr -d ' ')" ]] && echo "$g"
  return 0
}

alive() {
  local g
  g=$(pgid)
  [[ -n "$g" ]] && kill -0 -- "-$g" 2>/dev/null
}

doctor() {
  local quiet=${1:-}
  alive || { [[ -n "$quiet" ]] || log "FAIL no stack started by this script on port $PORT"; return 1; }
  local health
  health=$(curl -sf "$URL/api/health") || { [[ -n "$quiet" ]] || log "FAIL $URL/api/health did not answer 200"; return 1; }
  [[ "$health" == *'"ok":true'* ]] || { [[ -n "$quiet" ]] || log "FAIL health: $health"; return 1; }
  local served built
  served=$(curl -sf "$URL/" | grep -o 'assets/index-[^"]*\.js' | head -1)
  built=$(grep -o 'assets/index-[^"]*\.js' "$ROOT/apps/web/dist/index.html" | head -1)
  [[ "$served" == "$built" ]] || { [[ -n "$quiet" ]] || log "FAIL served bundle $served != built $built (stale stack, restart it)"; return 1; }
  [[ -n "$quiet" ]] || log "OK pgid=$(pgid) url=$URL health=$health bundle=$served"
}

start() {
  if doctor quiet; then log "already running at $URL"; return; fi
  if curl -s -o /dev/null "$URL"; then
    log "port $PORT is in use by a process this script did not start; rerun with PORT=<free port>"
    exit 1
  fi
  mkdir -p "$RUN_DIR"
  log "building web app"
  (cd "$ROOT" && pnpm build >"$RUN_DIR/build.log" 2>&1) || { cat "$RUN_DIR/build.log" >&2; exit 1; }
  rm -rf "$ROOT/apps/worker/$PERSIST"
  echo "$EVIDENCE_DIR" >"$RUN_DIR/evidence"
  log "starting wrangler dev with a fresh local D1 ($PERSIST)"
  # The session leader records its own pid, which is also the process group id of the whole stack.
  (cd "$ROOT" && PORT="$PORT" PERSIST_DIR="$PERSIST" RUN_DIR="$RUN_DIR" setsid sh -c \
    'echo $$ >"$RUN_DIR/pgid"; exec pnpm --filter @neon-cards/worker start' \
    >"$RUN_DIR/stack.log" 2>&1 </dev/null &)
  for _ in $(seq 1 20); do [[ -s "$RUN_DIR/pgid" ]] && break; sleep 0.1; done
  for _ in $(seq 1 90); do
    if curl -sf "$URL/api/health" >/dev/null; then doctor; return; fi
    alive || { log "stack exited during startup"; tail -40 "$RUN_DIR/stack.log" >&2; exit 1; }
    sleep 1
  done
  log "stack not ready after 90s"; tail -40 "$RUN_DIR/stack.log" >&2; stop; exit 1
}

drive() {
  mkdir -p "$EVIDENCE_DIR"
  node "$SCRIPTS/drive.mjs" --url "$URL" --out "$EVIDENCE_DIR" "$@"
  log "evidence in $EVIDENCE_DIR"
}

stop() {
  if alive; then
    local g
    g=$(pgid)
    kill -- "-$g" 2>/dev/null || true
    for _ in $(seq 1 20); do kill -0 -- "-$g" 2>/dev/null || break; sleep 0.25; done
    kill -9 -- "-$g" 2>/dev/null || true
    log "stopped pgid $g"
  fi
  [[ -f "$RUN_DIR/stack.log" ]] && mkdir -p "$EVIDENCE_DIR" && cp "$RUN_DIR/stack.log" "$EVIDENCE_DIR/stack.log" 2>/dev/null || true
  rm -rf "$RUN_DIR" "$ROOT/apps/worker/$PERSIST"
}

cmd=${1:-all}
[[ $# -gt 0 ]] && shift
case "$cmd" in
  start) start ;;
  doctor) doctor ;;
  drive) drive "$@" ;;
  stop) stop ;;
  all)
    if doctor quiet; then
      drive "$@"
    else
      trap stop EXIT
      start
      drive "$@"
    fi
    ;;
  *) echo "usage: $0 [all|start|doctor|drive|stop] [drive args...]" >&2; exit 2 ;;
esac
