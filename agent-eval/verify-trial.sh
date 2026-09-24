#!/bin/bash
# Usage: verify-trial.sh <impl> <trial-number>
# Applies the trial's saved patch to a fresh worktree, sets the app up, and
# scores it: typecheck + full test suite. Appends a verdict line to
# results/verdicts.txt, then removes the worktree.
#
# Env: LABEL (default <impl>) names results/<label>-<trial>.*, as in
# run-trial.sh. The worktree is cut at the commit the patch was made against:
# REF if set, else app_commit from <label>-<trial>.meta.json, else HEAD (older
# results carry no meta). A patch applied to another commit can still apply
# cleanly and be scored against the wrong dependencies.
set -uo pipefail

IMPL="${1:-${IMPL:-}}"
TRIAL="${2:-${TRIAL:-}}"
[ -n "$IMPL" ] && [ -n "$TRIAL" ] || { echo "usage: verify-trial.sh <impl> <trial-number>"; exit 2; }
LABEL="${LABEL:-$IMPL}"
[[ "$LABEL" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "LABEL must match [A-Za-z0-9._-]+: $LABEL"; exit 2; }
[[ "$TRIAL" =~ ^[0-9]+$ ]] || { echo "trial must be a number: $TRIAL"; exit 2; }
REPO="$(cd "$(dirname "$0")/.." && pwd)"
RESULTS="$REPO/agent-eval/results"
CELL="$LABEL-$TRIAL"
WT_ROOT="${WT_ROOT:-/tmp/agent-eval-worktrees}"
WT="$WT_ROOT/verify-$CELL"

BASE="${REF:-}"
if [ -z "$BASE" ] && [ -f "$RESULTS/$CELL.meta.json" ]; then
  BASE="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("app_commit") or "")' "$RESULTS/$CELL.meta.json" 2>/dev/null || true)"
fi
if [ -z "$BASE" ]; then
  echo "!! $CELL: no REF and no app_commit in meta; verifying against HEAD"
  BASE=HEAD
fi

rm -rf "$WT"
git -C "$REPO" worktree remove --force "$WT" 2>/dev/null || true
git -C "$REPO" worktree prune
git -C "$REPO" worktree add --detach "$WT" "$BASE" >/dev/null || { echo "$CELL WORKTREE-FAILED ($BASE)" >> "$RESULTS/verdicts.txt"; exit 1; }
APP="$WT/$IMPL"
cd "$APP"
git apply --whitespace=nowarn --exclude='*.db' --exclude='*.db-shm' --exclude='*.db-wal' --exclude='*.sqlite3' \
  "$RESULTS/$CELL.patch" || { echo "$CELL PATCH-APPLY-FAILED" >> "$RESULTS/verdicts.txt"; exit 1; }

TYPECHECK=fail; TESTS=fail; TESTCOUNT=""
case "$IMPL" in
  guren)
    bun install >/dev/null 2>&1; cp .env.example .env
    bunx guren key:generate --write >/dev/null; bun run codegen >/dev/null 2>&1; bun run db:migrate >/dev/null 2>&1
    bunx tsc --noEmit >/dev/null 2>&1 && TYPECHECK=pass
    OUT=$(bun test tests/ 2>&1); echo "$OUT" | grep -q " 0 fail" && TESTS=pass; TESTCOUNT=$(echo "$OUT" | grep -o "[0-9]* pass" | head -1)
    ;;
  hono)
    bun install >/dev/null 2>&1
    bunx tsc --noEmit >/dev/null 2>&1 && TYPECHECK=pass
    OUT=$(bun test 2>&1); echo "$OUT" | grep -q " 0 fail" && TESTS=pass; TESTCOUNT=$(echo "$OUT" | grep -o "[0-9]* pass" | head -1)
    ;;
  nextjs)
    npm install --silent >/dev/null 2>&1
    cp .env.example .env.local
    echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
    npm run db:migrate >/dev/null 2>&1
    npm run typecheck >/dev/null 2>&1 && TYPECHECK=pass
    OUT=$(npm test 2>&1); echo "$OUT" | grep -qE "Tests +[0-9]+ passed" && ! echo "$OUT" | grep -q "failed" && TESTS=pass
    TESTCOUNT=$(echo "$OUT" | grep -oE "Tests +[0-9]+ passed" | head -1)
    ;;
  tanstack)
    npm install --silent >/dev/null 2>&1; cp .env.example .env
    npx tsc --noEmit >/dev/null 2>&1 && TYPECHECK=pass
    OUT=$(npx vitest run 2>&1); echo "$OUT" | grep -qE "Tests +[0-9]+ passed" && ! echo "$OUT" | grep -q "failed" && TESTS=pass
    TESTCOUNT=$(echo "$OUT" | grep -oE "Tests +[0-9]+ passed" | head -1)
    ;;
  adonisjs)
    # AdonisJS needs Node 24; pick it up from mise when present, else trust PATH.
    if command -v mise >/dev/null 2>&1; then export PATH="$(mise where node@24.18.0)/bin:$PATH"; fi
    npm install --silent >/dev/null 2>&1; cp .env.example .env
    node ace generate:key >/dev/null 2>&1; mkdir -p tmp
    node ace serve >/dev/null 2>&1 & ADONIS_PID=$!
    sleep 25; kill "$ADONIS_PID" 2>/dev/null || true; wait "$ADONIS_PID" 2>/dev/null || true
    node ace migration:run >/dev/null 2>&1
    npm run typecheck >/dev/null 2>&1 && TYPECHECK=pass
    OUT=$(node ace test 2>&1); echo "$OUT" | grep -q "PASSED" && TESTS=pass; TESTCOUNT=$(echo "$OUT" | grep -oE "Tests +[0-9]+ passed" | head -1)
    ;;
  nestjs)
    npm install --silent >/dev/null 2>&1
    npm run typecheck >/dev/null 2>&1 && TYPECHECK=pass
    OUT=$(npm test 2>&1); echo "$OUT" | grep -qE "Tests: .*[0-9]+ passed" && ! echo "$OUT" | grep -qE "[0-9]+ failed" && TESTS=pass
    TESTCOUNT=$(echo "$OUT" | grep -oE "[0-9]+ passed" | head -1)
    ;;
esac

SMOKE=fail
bash "$REPO/agent-eval/smoke-trial.sh" "$IMPL" "$APP" >> "$RESULTS/$CELL.smoke.log" 2>&1 && SMOKE=pass

echo "$CELL typecheck=$TYPECHECK tests=$TESTS ($TESTCOUNT) smoke=$SMOKE" >> "$RESULTS/verdicts.txt"
cd /
git -C "$REPO" worktree remove --force "$WT" 2>/dev/null || rm -rf "$WT"
git -C "$REPO" worktree prune
echo "verified $CELL: typecheck=$TYPECHECK tests=$TESTS $TESTCOUNT"
