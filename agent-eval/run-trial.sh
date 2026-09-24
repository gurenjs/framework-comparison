#!/bin/bash
# Usage: run-trial.sh <impl> <trial-number>
# Creates an isolated worktree, sets the app up per its README, runs a fresh
# headless Claude Code session on TASK.md, and stores the event stream.
#
# Env:
#   MODEL     model id (default claude-sonnet-5)
#   GUIDANCE  shipped (default) | bare: strip the app's agent-guidance files
#   REF       commit the app is checked out at (default HEAD). TASK.md and
#             these scripts always come from the working copy, so REF=716117a
#             runs the July app under today's runner.
#   LABEL     results prefix (default <impl>): results/<label>-<trial>.*
#   EFFORT    passed as --effort only when set; meta records "default" otherwise
#   FORCE=1   overwrite an existing results/<label>-<trial>.stream.jsonl
#
# Permissions: file edits are auto-accepted inside the worktree
# (--permission-mode acceptEdits); Bash is limited to an allowlist of
# development commands. The same gate applies to every framework, so trials
# stay comparable.
set -euo pipefail

IMPL="${1:-${IMPL:-}}"
TRIAL="${2:-${TRIAL:-}}"
[ -n "$IMPL" ] && [ -n "$TRIAL" ] || { echo "usage: run-trial.sh <impl> <trial-number>"; exit 2; }
MODEL="${MODEL:-claude-sonnet-5}"
GUIDANCE="${GUIDANCE:-shipped}"
REF="${REF:-HEAD}"
LABEL="${LABEL:-$IMPL}"
EFFORT="${EFFORT:-}"
# LABEL and TRIAL end up in an rm -rf path.
[[ "$LABEL" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "LABEL must match [A-Za-z0-9._-]+: $LABEL"; exit 2; }
[[ "$TRIAL" =~ ^[0-9]+$ ]] || { echo "trial must be a number: $TRIAL"; exit 2; }
REPO="$(cd "$(dirname "$0")/.." && pwd)"
EVAL_DIR="$REPO/agent-eval"
WT_ROOT="${WT_ROOT:-/tmp/agent-eval-worktrees}"
WT="$WT_ROOT/$LABEL-$TRIAL"
RESULTS="$EVAL_DIR/results"
OUT="$RESULTS/$LABEL-$TRIAL"
PRECHECK_LOG="$OUT.precheck.log"
mkdir -p "$RESULTS" "$WT_ROOT"

if [ -e "$OUT.stream.jsonl" ] && [ "${FORCE:-}" != "1" ]; then
  echo "results/$LABEL-$TRIAL.stream.jsonl exists; pick another trial number or set FORCE=1"
  exit 2
fi
APP_COMMIT="$(git -C "$REPO" rev-parse --verify --quiet "$REF^{commit}")" || { echo "REF does not name a commit: $REF"; exit 2; }
RUNNER_COMMIT="$(git -C "$REPO" rev-parse HEAD)"
RUNNER_DIRTY=0
[ -z "$(git -C "$REPO" status --porcelain -- agent-eval ':!agent-eval/results')" ] || RUNNER_DIRTY=1

ALLOWED_TOOLS=(
  "Bash(bun:*)" "Bash(bunx:*)" "Bash(npm:*)" "Bash(npx:*)" "Bash(node:*)"
  "Bash(ls:*)" "Bash(cat:*)" "Bash(head:*)" "Bash(tail:*)" "Bash(wc:*)"
  "Bash(grep:*)" "Bash(rg:*)" "Bash(find:*)" "Bash(sed:*)" "Bash(awk:*)"
  "Bash(mkdir:*)" "Bash(cp:*)" "Bash(mv:*)" "Bash(touch:*)"
  "Bash(sqlite3:*)" "Bash(openssl:*)" "Bash(sleep:*)" "Bash(kill:*)"
)
# No network documentation access for any arm: WebFetch / WebSearch are
# denied and curl is deliberately absent from the allowlist.
DISALLOWED_TOOLS=("WebFetch" "WebSearch")

# Isolation, identical for every arm (ported from agents-on-guren run.sh):
# --strict-mcp-config drops every MCP server, the operator's personal ones and
# the app's .mcp.json alike; --setting-sources project,local drops user-level
# settings, plugins and hooks, so a cell sees only the worktree.
CLAUDE_FLAGS=(
  --model "$MODEL"
  --max-turns 120
  --output-format stream-json --verbose
  --permission-mode acceptEdits
  --strict-mcp-config
  --setting-sources project,local
)
[ -z "$EFFORT" ] || CLAUDE_FLAGS+=(--effort "$EFFORT")
CLAUDE_FLAGS+=(--allowedTools "${ALLOWED_TOOLS[@]}" --disallowedTools "${DISALLOWED_TOOLS[@]}")
# Auto-memory is keyed to the main repository's path, so every worktree cell
# would share one memory directory: a note written in one cell is read in the next.
ISOLATION_ENV=("CLAUDE_CODE_DISABLE_AUTO_MEMORY=1")

echo "== worktree: $WT"
rm -rf "$WT"
git -C "$REPO" worktree remove --force "$WT" 2>/dev/null || true
git -C "$REPO" worktree add --detach "$WT" "$APP_COMMIT" >/dev/null

APP="$WT/$IMPL"
cd "$APP"

echo "== setup ($IMPL at ${APP_COMMIT:0:12}, label $LABEL)"
case "$IMPL" in
  guren)
    bun install >/dev/null 2>&1
    cp .env.example .env
    bunx guren key:generate --write >/dev/null
    bun run codegen >/dev/null 2>&1
    bun run db:migrate >/dev/null 2>&1
    bun run typecheck >/dev/null && bun test tests/ >"$PRECHECK_LOG" 2>&1 || { echo "PRE-CHECK FAILED"; exit 1; }
    ;;
  nextjs)
    npm install --silent >/dev/null 2>&1
    cp .env.example .env.local
    echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
    npm run db:migrate >/dev/null 2>&1
    npm run typecheck >/dev/null && npm test >"$PRECHECK_LOG" 2>&1 || { echo "PRE-CHECK FAILED"; exit 1; }
    ;;
  hono)
    bun install >/dev/null 2>&1
    bunx tsc --noEmit >/dev/null && bun test >"$PRECHECK_LOG" 2>&1 || { echo "PRE-CHECK FAILED"; exit 1; }
    ;;
  tanstack)
    npm install --silent >/dev/null 2>&1
    cp .env.example .env
    npm run typecheck >/dev/null && npx vitest run >"$PRECHECK_LOG" 2>&1 || { echo "PRE-CHECK FAILED"; exit 1; }
    ;;
  adonisjs)
    # AdonisJS needs Node 24; pick it up from mise when present, else trust PATH.
    if command -v mise >/dev/null 2>&1; then export PATH="$(mise where node@24.18.0)/bin:$PATH"; fi
    npm install --silent >/dev/null 2>&1
    cp .env.example .env
    node ace generate:key >/dev/null
    mkdir -p tmp # gitignored SQLite directory
    # .adonisjs/ type registries are gitignored; a dev-server boot regenerates
    # them, and every other ace command (incl. migration:run) needs them.
    node ace serve >/dev/null 2>&1 & ADONIS_PID=$!
    sleep 25; kill "$ADONIS_PID" 2>/dev/null || true; wait "$ADONIS_PID" 2>/dev/null || true
    node ace migration:run >/dev/null 2>&1
    npm run typecheck >/dev/null 2>&1 && node ace test >"$PRECHECK_LOG" 2>&1 || { echo "PRE-CHECK FAILED"; exit 1; }
    ;;
  nestjs)
    npm install --silent >/dev/null 2>&1
    npm run typecheck >/dev/null && npm test >"$PRECHECK_LOG" 2>&1 || { echo "PRE-CHECK FAILED"; exit 1; }
    ;;
  *) echo "unknown impl: $IMPL"; exit 1 ;;
esac

# GUIDANCE=bare strips the agent-guidance files the scaffold ships, so the
# same worktree can measure the undocumented baseline. Default: as committed.
if [ "$GUIDANCE" = "bare" ]; then
  echo "== guidance: bare (stripping CLAUDE.md / .claude / .mcp.json / AGENTS.md)"
  rm -rf "$APP/CLAUDE.md" "$APP/.claude" "$APP/.mcp.json" "$APP/AGENTS.md"
fi

# The pass count summarize.ts compares "to green" against; it moves when an
# arm's dependencies do, so the constant there is only a fallback.
case "$IMPL" in
  guren|hono) BASELINE_TESTS=$(grep -oE '[0-9]+ pass' "$PRECHECK_LOG" | head -1 | grep -oE '[0-9]+' || true) ;;
  nestjs)     BASELINE_TESTS=$(grep -E 'Tests:' "$PRECHECK_LOG" | grep -oE '[0-9]+ passed' | head -1 | grep -oE '[0-9]+' || true) ;;
  *)          BASELINE_TESTS=$(grep -oE 'Tests +[0-9]+ passed' "$PRECHECK_LOG" | head -1 | grep -oE '[0-9]+' || true) ;;
esac

# Provenance snapshot after setup, before the agent can change dependencies.
# A meta failure must never skip the run, the patch, or the cleanup.
TRIAL_IMPL="$IMPL" TRIAL_LABEL="$LABEL" TRIAL_NUMBER="$TRIAL" TRIAL_GUIDANCE="$GUIDANCE" \
TRIAL_MODEL="$MODEL" TRIAL_EFFORT="$EFFORT" TRIAL_REF="$REF" TRIAL_APP_COMMIT="$APP_COMMIT" \
TRIAL_RUNNER_COMMIT="$RUNNER_COMMIT" TRIAL_RUNNER_DIRTY="$RUNNER_DIRTY" \
TRIAL_CLAUDE_VERSION="$(claude --version 2>/dev/null || echo unknown)" \
TRIAL_BUN_VERSION="$(bun --version 2>/dev/null || echo unknown)" \
TRIAL_NODE_VERSION="$(node --version 2>/dev/null || echo unknown)" \
TRIAL_BASELINE_TESTS="$BASELINE_TESTS" \
TRIAL_ISOLATION_ENV="$(printf '%s\n' "${ISOLATION_ENV[@]}")" \
TRIAL_ALLOWED_TOOLS="$(printf '%s\n' "${ALLOWED_TOOLS[@]}")" \
TRIAL_DISALLOWED_TOOLS="$(printf '%s\n' "${DISALLOWED_TOOLS[@]}")" \
  bun "$EVAL_DIR/trial-meta.ts" pre "$OUT.meta.json" "$APP" -- "${CLAUDE_FLAGS[@]}" \
  || echo "!! meta (pre) failed; continuing"
echo "== pre-check green (${BASELINE_TESTS:-?} tests); starting agent (model: $MODEL, effort: ${EFFORT:-default})"

START=$(date +%s)
env "${ISOLATION_ENV[@]}" claude -p "$(cat "$EVAL_DIR/TASK.md")" "${CLAUDE_FLAGS[@]}" \
  > "$OUT.stream.jsonl" 2> "$OUT.stderr.log" || true
END=$(date +%s)
echo "== agent finished in $((END-START))s"
# The result event is not always the last line of the stream (newer CLIs
# append a task_summary after it): take the last line whose type is "result".
python3 - "$OUT.stream.jsonl" "$OUT.result.json" <<'PY_RESULT' || echo "!! result extraction failed"
import json, sys
last = None
for line in open(sys.argv[1]):
    line = line.strip()
    if not line: continue
    try: ev = json.loads(line)
    except json.JSONDecodeError: continue
    if ev.get('type') == 'result': last = line
open(sys.argv[2], 'w').write((last or '{}') + '\n')
PY_RESULT
bun "$EVAL_DIR/trial-meta.ts" post "$OUT.meta.json" "$OUT.stream.jsonl" || echo "!! meta (post) failed"
echo "== result saved: $OUT.result.json"

# Preserve the agent's work as a patch, then drop the worktree (disk hygiene).
cd "$APP"
git add -A >/dev/null 2>&1 || true
git diff --cached --binary HEAD > "$OUT.patch" 2>/dev/null || true
cd /
git -C "$REPO" worktree remove --force "$WT" 2>/dev/null || rm -rf "$WT"
git -C "$REPO" worktree prune
echo "== worktree cleaned; patch: $OUT.patch"
