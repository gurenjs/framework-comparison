#!/bin/bash
# Usage: probe-context.sh <arm> [file ...]
#
# Measures context size in an arm's start state (what an agent sees), with
# one short headless session per probe, same runner flags as run-cell.sh:
#   (start)   "Reply OK."                  -> session-start context
#   <file>    "Read <file>, then reply OK." -> context after reading that file
# Prints the input tokens (input + cache write + cache read) of the session's
# last model call, and the file's size in characters. For the Guren arm, the
# difference between files of similar size shows which path-scoped rules
# (.claude/rules/*.md, `paths:`) attached on the read.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
ARM="$1"; shift
MODEL="${MODEL:-claude-sonnet-5-5}"
WT="$WT_ROOT/probe-context-$ARM"
make_start_state "$ARM" post-tags "$WT" >/dev/null
setup_app "$ARM" "$WT"
if [ "$ARM" = guren ]; then (cd "$WT" && bunx guren agent:init --target claude >/dev/null 2>&1); fi

probe() { # <label> <prompt> [file]
  local out chars="-"
  [ -n "${3:-}" ] && chars="$(wc -c < "$WT/$3" | tr -d ' ')"
  out="$(cd "$WT" && env CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 claude -p "$2" --model "$MODEL" --max-turns 3 \
    --output-format stream-json --verbose --strict-mcp-config --setting-sources project,local \
    --allowedTools Read --disallowedTools WebFetch WebSearch Bash 2>/dev/null)"
  python3 -c '
import json, sys
last = None
for line in sys.stdin:
    try: e = json.loads(line)
    except ValueError: continue
    if e.get("type") == "assistant":
        u = e["message"].get("usage", {})
        last = u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0) + u.get("cache_read_input_tokens", 0)
print(last)' <<<"$out" | xargs -I{} printf '%-55s input_tokens=%-7s file_chars=%s\n' "$1" {} "$chars"
}

probe "(start)" "Reply with the single word OK."
for f in "$@"; do
  probe "$f" "Use the Read tool to read $f, then reply with the single word OK." "$f"
done
drop_start_state "$ARM" "$WT"
