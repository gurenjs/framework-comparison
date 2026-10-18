#!/usr/bin/env bash
# run.sh <driver> <app-dir> <task> [port]
#
# Boots the app for <driver> on a fresh database, runs
# tests/<task>.test.ts against it, stops the server, and exits with the test
# status (0 = all assertions passed).
#
# Framework-specific extras (tests/extras/<task>.*.test.ts) run afterwards on
# the same server only when SUITE_EXTRAS=1; their result is printed but never
# changes the exit status (they are not part of the shared grade).
set -uo pipefail

DRIVER="${1:?usage: run.sh <guren|void> <app-dir> <task> [port]}"
APP="${2:?usage: run.sh <driver> <app-dir> <task> [port]}"
TASK="${3:?usage: run.sh <driver> <app-dir> <task> [port]}"
PORT="${4:-${SUITE_PORT:-4100}}"
SUITE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST="$SUITE/tests/$TASK.test.ts"
[ -f "$TEST" ] || { echo "no such test: $TEST" >&2; exit 2; }

BOOT="$SUITE/boot-$DRIVER.sh"
[ -x "$BOOT" ] || { echo "no boot script for driver '$DRIVER' ($BOOT)" >&2; exit 2; }

# Two Void dev servers at once collide (inspector port, optimizer), so Void
# runs hold a machine-wide lock from boot to shutdown.
LOCK=""
if [ "$DRIVER" = void ]; then
  LOCK=/tmp/void-suite.lock
  until mkdir "$LOCK" 2>/dev/null; do
    # A lock whose owner died is stale.
    owner="$(cat "$LOCK/pid" 2>/dev/null || true)"
    if [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; then rm -rf "$LOCK"; continue; fi
    sleep 2
  done
  echo $$ > "$LOCK/pid"
fi
release() { [ -n "$LOCK" ] && rm -rf "$LOCK"; return 0; }

PID="$("$BOOT" "$APP" "$PORT")" || { echo "boot failed" >&2; release; exit 3; }
# The server PID can be the root of a tree (npx -> vp -> vite -> workerd);
# stop every descendant too, or a survivor keeps the port and the local DB.
tree() { local p; for p in $(pgrep -P "$1"); do tree "$p"; done; echo "$1"; }
cleanup() {
  local pids; pids="$(tree "$PID")"
  kill $pids 2>/dev/null || true
  for _ in $(seq 1 25); do kill -0 $pids 2>/dev/null || break; sleep 0.2; done
  kill -9 $pids 2>/dev/null || true
  for _ in $(seq 1 25); do lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 || break; sleep 0.2; done
  release
}
trap cleanup EXIT

cd "$SUITE"
export SUITE_DRIVER="$DRIVER" SUITE_BASE_URL="http://127.0.0.1:$PORT" SUITE_APP_DIR="$(cd "$APP" && pwd)"
bun test --timeout 30000 "./tests/$TASK.test.ts"
STATUS=$?

if [ "${SUITE_EXTRAS:-0}" = 1 ]; then
  shopt -s nullglob
  for extra in ./tests/extras/"$TASK".*.test.ts; do
    echo "--- extra (not graded): $extra"
    bun test --timeout 30000 "$extra"
    echo "--- extra exit: $?"
  done
fi

exit $STATUS
