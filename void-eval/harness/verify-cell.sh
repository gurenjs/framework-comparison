#!/bin/bash
# Usage: verify-cell.sh <task> <arm> <model> <trial>
#
# Scores one cell: a fresh seeded start state, the agent's patch, setup, then
# typecheck and the black-box suite (suite/run.sh <arm>). PASS = suite green
# AND typecheck green, the gate agents-on-guren uses (hidden + typecheck).
# Writes results/<cell>.verdict.json; never touches the stream or the patch.
set -uo pipefail
source "$(dirname "$0")/lib.sh"

TASK="$1"; ARM="$2"; MODEL="$3"; TRIAL="$4"
CELL="$(cell_id "$TASK" "$ARM" "$MODEL" "$TRIAL")"
OUT="$RESULTS/$CELL"
WT="$WT_ROOT/verify-$TASK-$ARM-$MODEL-$TRIAL"
PORT="${SUITE_PORT:-$([ "$ARM" = guren ] && echo 4100 || echo 4200)}"
[ -f "$OUT.patch" ] || { echo "no patch for $CELL"; exit 2; }

verdict() { # <status> [typecheck] [suite] [summary]
  printf '{"task":"%s","arm":"%s","model":"%s","trial":%s,"status":"%s","typecheck":"%s","suite":"%s","suite_summary":"%s"}\n' \
    "$TASK" "$ARM" "$MODEL" "$TRIAL" "$1" "${2:-}" "${3:-}" "${4:-}" > "$OUT.verdict.json"
  echo "verdict $CELL: $1 (typecheck=${2:-} suite=${3:-} ${4:-})"
}

make_start_state "$ARM" "$TASK" "$WT" >/dev/null || { verdict "SEED-FAILED"; exit 1; }
if [ -s "$OUT.patch" ]; then
  git -C "$WT" apply --whitespace=nowarn "$OUT.patch" || { verdict "PATCH-APPLY-FAILED"; drop_start_state "$ARM" "$WT"; exit 1; }
fi
setup_app "$ARM" "$WT"

TC=fail; SU=fail
typecheck "$ARM" "$WT" "$OUT.typecheck.log" && TC=pass
"$VE_ROOT/suite/run.sh" "$ARM" "$WT" "$TASK" "$PORT" > "$OUT.suite.log" 2>&1
# run.sh: 0 = all tests passed, 1 = a test failed. Anything else (boot
# failure 3, usage error 2, interrupted 130, ...) says nothing about the
# agent's patch, so it is recorded as a harness error and run-matrix.sh
# grades the cell again on its next pass.
case $? in 0) SU=pass ;; 1) SU=fail ;; *) SU=harness-error ;; esac
CNT="$(grep -oE '^ *[0-9]+ (pass|fail)$' "$OUT.suite.log" | tr -s ' ' | tr '\n' ' ' | sed 's/^ //; s/ $//')"

if [ "$SU" = harness-error ]; then STATUS=HARNESS-ERROR
elif [ "$TC" = pass ] && [ "$SU" = pass ]; then STATUS=PASS; else STATUS=FAIL; fi
verdict "$STATUS" "$TC" "$SU" "$CNT"
drop_start_state "$ARM" "$WT"
