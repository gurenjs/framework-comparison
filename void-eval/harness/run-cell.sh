#!/bin/bash
# Usage: run-cell.sh <task> <arm:guren|void> <model> <trial>
#
# One cell: build the arm's seeded start state, install what the framework
# ships for agents, run a headless Claude Code session on the task, and store
# the event stream, the result event and the agent's patch.
# Runner flags and isolation follow agents-on-guren/harness/run.sh.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

TASK="$1"; ARM="$2"; MODEL="$3"; TRIAL="$4"
MAX_TURNS="${MAX_TURNS:-120}"
CELL="$(cell_id "$TASK" "$ARM" "$MODEL" "$TRIAL")"
OUT="$RESULTS/$CELL"
WT="$WT_ROOT/run-$TASK-$ARM-$MODEL-$TRIAL"
mkdir -p "$(dirname "$OUT")" "$WT_ROOT"
[ -e "$OUT.stream.jsonl" ] && [ "${FORCE:-}" != 1 ] && { echo "$CELL exists; FORCE=1 to overwrite"; exit 2; }

# One allowlist for both arms: the union of what either framework's docs tell
# an agent to run (Guren: bun/bunx; Void: pnpm, npx void, vp).
ALLOWED_TOOLS=(
  "Bash(bun:*)" "Bash(bunx:*)" "Bash(npm:*)" "Bash(npx:*)" "Bash(node:*)"
  "Bash(pnpm:*)" "Bash(vp:*)"
  "Bash(ls:*)" "Bash(cat:*)" "Bash(head:*)" "Bash(tail:*)" "Bash(wc:*)"
  "Bash(grep:*)" "Bash(rg:*)" "Bash(find:*)" "Bash(sed:*)" "Bash(awk:*)"
  "Bash(mkdir:*)" "Bash(cp:*)" "Bash(mv:*)" "Bash(touch:*)"
  "Bash(sqlite3:*)" "Bash(openssl:*)" "Bash(sleep:*)" "Bash(kill:*)"
  "Bash(git:*)" "Bash(env:*)" "Bash(python3:*)"
)
# No web docs for either arm, and nothing that reaches Cloudflare or a Void
# platform: deploy, connect and login are denied however they are invoked.
DISALLOWED_TOOLS=("WebFetch" "WebSearch")
for runner in "npx void" "pnpm void" "pnpm exec void" "npx -y void" "node_modules/.bin/void"; do
  for sub in deploy connect login logout secret platform project; do
    DISALLOWED_TOOLS+=("Bash($runner $sub:*)")
  done
done

echo "== cell: $CELL"
make_start_state "$ARM" "$TASK" "$WT" || { echo "START-STATE FAILED ($CELL)"; exit 1; }
setup_app "$ARM" "$WT"
typecheck "$ARM" "$WT" /dev/null || { echo "PRE-CHECK FAILED: start state does not typecheck ($CELL)"; drop_start_state "$ARM" "$WT"; exit 1; }

if [ "$ARM" = guren ]; then
  # What `agent:init` installs from the CLI in node_modules, nothing hand-written.
  (cd "$WT" && bunx guren agent:init --target claude >/dev/null 2>&1)
  git -C "$WT" add -A && git -C "$WT" "${GIT_ID[@]}" commit -q -m "harness: agent:init" --no-verify
fi
echo "== guidance: $(cd "$WT" && ls -d CLAUDE.md AGENTS.md .claude/skills/* .claude/rules .claude/settings.json 2>/dev/null | tr '\n' ' ')"

PROMPT="$(build_prompt "$ARM" "$TASK")"
START_COMMIT="$(git -C "$WT" rev-parse HEAD)"
echo "== starting agent (model: $MODEL, max-turns: $MAX_TURNS)"
START=$(date +%s)
cd "$WT"
env CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 claude -p "$PROMPT" \
  --model "$MODEL" \
  --max-turns "$MAX_TURNS" \
  --output-format stream-json --verbose --include-hook-events \
  --permission-mode acceptEdits \
  --strict-mcp-config \
  --setting-sources project,local \
  --allowedTools "${ALLOWED_TOOLS[@]}" \
  --disallowedTools "${DISALLOWED_TOOLS[@]}" \
  > "$OUT.stream.jsonl" 2> "$OUT.stderr.log" || true
END=$(date +%s)
echo "== agent finished in $((END-START))s"

python3 - "$OUT.stream.jsonl" "$OUT.result.json" <<'PY'
import json, sys
last = None
for line in open(sys.argv[1]):
    line = line.strip()
    if not line: continue
    try: ev = json.loads(line)
    except json.JSONDecodeError: continue
    if ev.get('type') == 'result': last = line
open(sys.argv[2], 'w').write((last or '{}') + '\n')
PY
python3 - "$TASK" "$ARM" "$MODEL" "$TRIAL" "$((END-START))" "$START_COMMIT" "$MAX_TURNS" "$(claude --version 2>/dev/null | head -1)" "$OUT.stream.jsonl" > "$OUT.meta.json" <<'PY'
import json, sys
t, a, m, tr, w, sc, mt, cv, stream = sys.argv[1:10]
init = next((e for e in map(json.loads, filter(str.strip, open(stream))) if e.get("subtype") == "init"), {})
json.dump({"task": t, "arm": a, "model": m, "trial": int(tr), "wall_seconds": int(w), "start_commit": sc,
           "max_turns": int(mt), "claude_version": cv, "memory_paths": init.get("memory_paths"),
           "skills": init.get("skills"), "slash_commands": init.get("slash_commands")}, sys.stdout)
print()
PY

git -C "$WT" add -A >/dev/null 2>&1 || true
git -C "$WT" diff --cached --binary "$START_COMMIT" -- . ':(exclude)*.db' ':(exclude)*.db-shm' ':(exclude)*.db-wal' ':(exclude)data/' ':(exclude).void/' ':(exclude).wrangler/' > "$OUT.patch" 2>/dev/null || true
drop_start_state "$ARM" "$WT"
echo "== saved: results/$CELL.{stream.jsonl,result.json,patch,meta.json}"
