#!/usr/bin/env bash
# boot-void.sh <app-dir> <port>
#
# Starts the Void blog app with `vp dev` (Void's local runtime: miniflare,
# local D1; no Cloudflare account involved) on 127.0.0.1:<port> against an
# empty local state (.void/v3 removed: D1, KV, cache), waits for /health and
# for the migrations to have run, and prints the server PID on stdout. Logs go
# to <app-dir>/.void-suite-server.log.
#
# Dev mode on purpose: a production preview needs a deploy-time
# BETTER_AUTH_SECRET and a build, and `vp dev` is what the Void docs run.
set -euo pipefail

APP="${1:?usage: boot-void.sh <app-dir> <port>}"
PORT="${2:?usage: boot-void.sh <app-dir> <port>}"
APP="$(cd "$APP" && pwd)"
BASE="http://127.0.0.1:$PORT"
NODE24_BIN="${NODE24_BIN:-$(mise where node@24.22.0 2>/dev/null)/bin}"
export PATH="$NODE24_BIN:$PATH"

log() { echo "[boot-void] $*" >&2; }

if curl -s -o /dev/null --max-time 2 "$BASE/health"; then
  log "port $PORT already answers; refusing to start (a stale server would be graded instead)"
  exit 1
fi

cd "$APP"
if [ ! -d node_modules ]; then
  log "pnpm install"
  pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1
fi
rm -rf .void/v3
LOG="$APP/.void-suite-server.log"
nohup npx vp dev --host 127.0.0.1 --port "$PORT" --strictPort >"$LOG" 2>&1 </dev/null &
PID=$!

for _ in $(seq 1 240); do
  if ! kill -0 "$PID" 2>/dev/null; then
    log "server exited during boot; log:"; tail -40 "$LOG" >&2; exit 1
  fi
  # /posts touches the posts table, so a 200 also means migrations ran.
  if curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$BASE/posts" | grep -q '^200$'; then
    log "ready on $BASE (pid $PID)"
    echo "$PID"
    exit 0
  fi
  sleep 0.5
done
log "timed out waiting for $BASE/posts"; kill "$PID" 2>/dev/null || true; exit 1
