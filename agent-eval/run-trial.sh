#!/bin/bash
# Usage: run-trial.sh <impl> <trial-number>
# Creates an isolated worktree, sets the app up per its README, runs a fresh
# headless Claude Code session on TASK.md, and stores the event stream.
#
# Permissions: file edits are auto-accepted inside the worktree
# (--permission-mode acceptEdits); Bash is limited to an allowlist of
# development commands. The same gate applies to every framework, so trials
# stay comparable.
set -euo pipefail

IMPL="$1"
TRIAL="$2"
MODEL="${MODEL:-claude-sonnet-5}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
EVAL_DIR="$REPO/agent-eval"
WT_ROOT="${WT_ROOT:-/tmp/agent-eval-worktrees}"
WT="$WT_ROOT/$IMPL-$TRIAL"
RESULTS="$EVAL_DIR/results"
mkdir -p "$RESULTS" "$WT_ROOT"

ALLOWED_TOOLS=(
  "Bash(bun:*)" "Bash(bunx:*)" "Bash(npm:*)" "Bash(npx:*)" "Bash(node:*)"
  "Bash(ls:*)" "Bash(cat:*)" "Bash(head:*)" "Bash(tail:*)" "Bash(wc:*)"
  "Bash(grep:*)" "Bash(rg:*)" "Bash(find:*)" "Bash(sed:*)" "Bash(awk:*)"
  "Bash(mkdir:*)" "Bash(cp:*)" "Bash(mv:*)" "Bash(touch:*)"
  "Bash(curl:*)" "Bash(sqlite3:*)" "Bash(openssl:*)" "Bash(sleep:*)" "Bash(kill:*)"
)

echo "== worktree: $WT"
rm -rf "$WT"
git -C "$REPO" worktree remove --force "$WT" 2>/dev/null || true
git -C "$REPO" worktree add --detach "$WT" HEAD >/dev/null

APP="$WT/$IMPL"
cd "$APP"

echo "== setup ($IMPL)"
case "$IMPL" in
  guren)
    bun install >/dev/null 2>&1
    cp .env.example .env
    bunx guren key:generate --write >/dev/null
    bun run codegen >/dev/null 2>&1
    bun run db:migrate >/dev/null 2>&1
    bun run typecheck >/dev/null && bun test tests/ >/dev/null 2>&1 || { echo "PRE-CHECK FAILED"; exit 1; }
    ;;
  nextjs)
    npm install --silent >/dev/null 2>&1
    cp .env.example .env.local
    echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
    npm run db:migrate >/dev/null 2>&1
    npm run typecheck >/dev/null && npm test >/dev/null 2>&1 || { echo "PRE-CHECK FAILED"; exit 1; }
    ;;
  hono)
    bun install >/dev/null 2>&1
    bunx tsc --noEmit >/dev/null && bun test >/dev/null 2>&1 || { echo "PRE-CHECK FAILED"; exit 1; }
    ;;
  tanstack)
    npm install --silent >/dev/null 2>&1
    cp .env.example .env
    npm run typecheck >/dev/null && npx vitest run >/dev/null 2>&1 || { echo "PRE-CHECK FAILED"; exit 1; }
    ;;
  adonisjs)
    export PATH="$(/opt/homebrew/bin/mise where node@24.18.0)/bin:$PATH"
    npm install --silent >/dev/null 2>&1
    cp .env.example .env
    node ace generate:key >/dev/null
    mkdir -p tmp # gitignored SQLite directory
    # .adonisjs/ type registries are gitignored; a dev-server boot regenerates
    # them, and every other ace command (incl. migration:run) needs them.
    (node ace serve >/dev/null 2>&1 & echo $! > /tmp/adonis-barrel.pid)
    sleep 25; kill "$(cat /tmp/adonis-barrel.pid)" 2>/dev/null || true
    lsof -ti:3333 | xargs kill 2>/dev/null || true
    node ace migration:run >/dev/null 2>&1
    npm run typecheck >/dev/null 2>&1 && node ace test >/dev/null 2>&1 || { echo "PRE-CHECK FAILED"; exit 1; }
    ;;
  nestjs)
    npm install --silent >/dev/null 2>&1
    npm run typecheck >/dev/null && npm test >/dev/null 2>&1 || { echo "PRE-CHECK FAILED"; exit 1; }
    ;;
  *) echo "unknown impl: $IMPL"; exit 1 ;;
esac
echo "== pre-check green; starting agent (model: $MODEL)"

START=$(date +%s)
claude -p "$(cat "$EVAL_DIR/TASK.md")" \
  --model "$MODEL" \
  --max-turns 120 \
  --output-format stream-json --verbose \
  --permission-mode acceptEdits \
  --allowedTools "${ALLOWED_TOOLS[@]}" \
  > "$RESULTS/$IMPL-$TRIAL.stream.jsonl" 2> "$RESULTS/$IMPL-$TRIAL.stderr.log" || true
END=$(date +%s)
echo "== agent finished in $((END-START))s"
tail -1 "$RESULTS/$IMPL-$TRIAL.stream.jsonl" > "$RESULTS/$IMPL-$TRIAL.result.json"
echo "== result saved: $RESULTS/$IMPL-$TRIAL.result.json"

# Preserve the agent's work as a patch, then drop the worktree (disk hygiene).
cd "$APP"
git add -A >/dev/null 2>&1 || true
git diff --cached HEAD > "$RESULTS/$IMPL-$TRIAL.patch" 2>/dev/null || true
cd /
git -C "$REPO" worktree remove --force "$WT" 2>/dev/null || rm -rf "$WT"
git -C "$REPO" worktree prune
echo "== worktree cleaned; patch: $RESULTS/$IMPL-$TRIAL.patch"
