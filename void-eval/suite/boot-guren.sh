#!/usr/bin/env bash
# boot-guren.sh <app-dir> <port>
#
# Starts the Guren blog app in production mode (NODE_ENV=production, no --hot,
# no seed-on-boot) on 127.0.0.1:<port> against a brand-new SQLite file, waits
# for /health, and prints the server PID on stdout (logs go to
# <app-dir>/data/suite-server.log). Kill the PID when done.
#
# First-time setup is done here if missing (mirrors harness/lib.sh setup_app):
# bun install, .env + APP_KEY, codegen, and the client build (vite) whose
# assets the production document references. Set SUITE_REBUILD=1 to force the
# build. Codegen always runs, as the harness does before grading.
set -euo pipefail

APP="${1:?usage: boot-guren.sh <app-dir> <port>}"
PORT="${2:?usage: boot-guren.sh <app-dir> <port>}"
APP="$(cd "$APP" && pwd)"
BASE="http://127.0.0.1:$PORT"

log() { echo "[boot-guren] $*" >&2; }

if curl -s -o /dev/null --max-time 2 "$BASE/health"; then
  log "port $PORT already answers; refusing to start (a stale server would be graded instead)"
  exit 1
fi

cd "$APP"
if [ ! -d node_modules ]; then
  log "bun install"
  bun install --frozen-lockfile >/dev/null 2>&1 || bun install >/dev/null 2>&1
fi
if [ ! -f .env ]; then
  cp .env.example .env
  bunx guren key:generate --write >/dev/null 2>&1
fi
log "codegen"
bun run codegen >/dev/null 2>&1 || { log "codegen failed"; exit 1; }
if [ "${SUITE_REBUILD:-0}" = 1 ] || [ ! -d public/assets ] || [ ! -d .guren/ssr ]; then
  log "vite build (client + ssr)"
  bunx vite build >/dev/null 2>&1 && bunx vite build --ssr >/dev/null 2>&1 || { log "vite build failed"; exit 1; }
fi

mkdir -p data
DB="./data/suite.db"
rm -f "$DB" "$DB-wal" "$DB-shm" "$DB-journal"
LOG="$APP/data/suite-server.log"

# Production: migrations auto-apply on boot, seeders do not run, so the DB
# starts empty. Host authorization only answers APP_URL's hostname.
NODE_ENV=production \
APP_URL="$BASE" \
HOST=127.0.0.1 \
PORT="$PORT" \
GUREN_STRICT_PORT=1 \
DATABASE_URL="$DB" \
  nohup bun bin/serve.ts >"$LOG" 2>&1 </dev/null &
PID=$!

for _ in $(seq 1 120); do
  if ! kill -0 "$PID" 2>/dev/null; then
    log "server exited during boot; log:"; tail -40 "$LOG" >&2; exit 1
  fi
  if curl -s -o /dev/null --max-time 2 -w '%{http_code}' "$BASE/health" | grep -q '^200$'; then
    if kill -0 "$PID" 2>/dev/null; then
      log "ready on $BASE (pid $PID)"
      echo "$PID"
      exit 0
    fi
  fi
  sleep 0.5
done
log "timed out waiting for $BASE/health"; kill "$PID" 2>/dev/null || true; exit 1
