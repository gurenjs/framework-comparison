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
LOG="$APP/.void-suite-server.log"
tree() { local p; for p in $(pgrep -P "$1"); do tree "$p"; done; echo "$1"; }
stop() { kill $(tree "$1") 2>/dev/null || true; sleep 2; kill -9 $(tree "$1") 2>/dev/null || true; }

# `vp dev` occasionally stalls in Vite's dependency optimizer on a cold
# start and never answers; the optimizer cache it leaves makes the next start
# fast. So: up to 3 attempts of 90 s, each on a fresh local state.
for attempt in 1 2 3; do
  rm -rf .void/v3
  nohup npx vp dev --host 127.0.0.1 --port "$PORT" --strictPort >"$LOG" 2>&1 </dev/null &
  PID=$!
  for _ in $(seq 1 180); do
    if ! kill -0 "$PID" 2>/dev/null; then
      log "server exited during boot (attempt $attempt); log:"; tail -40 "$LOG" >&2; break
    fi
    # /posts touches the posts table, so a 200 also means migrations ran.
    if curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$BASE/posts" | grep -q '^200$'; then
      log "ready on $BASE (pid $PID, attempt $attempt)"
      echo "$PID"
      exit 0
    fi
    sleep 0.5
  done
  log "no answer from $BASE/posts (attempt $attempt); log tail:"; tail -8 "$LOG" >&2
  stop "$PID"
  for _ in $(seq 1 25); do lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 || break; sleep 0.2; done
done
log "giving up after 3 attempts"; exit 1
