#!/usr/bin/env bash
# run-extras-on.sh <arm: guren|void> <task> [patch]
#
# Builds the arm's start state for <task> (harness/lib.sh make_start_state,
# GUREN_BASE honoured), applies [patch] (an agent's patch, or a reference),
# sets the app up, runs the graded test and the not-graded extras
# (SUITE_EXTRAS=1), and prints the run log. Used to re-grade saved patches
# against tests/extras/*.
set -uo pipefail
SUITE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VE="$(cd "$SUITE/.." && pwd)"
source "$VE/harness/lib.sh"
ARM="$1"; TASK="$2"; PATCH="${3:-}"
[ -n "$PATCH" ] && PATCH="$(cd "$(dirname "$PATCH")" && pwd)/$(basename "$PATCH")"
PORT="${SUITE_PORT:-$([ "$ARM" = guren ] && echo 4110 || echo 4210)}"
WT="$WT_ROOT/extras-$ARM-$TASK-$$"
make_start_state "$ARM" "$TASK" "$WT" >/dev/null || { echo "START-STATE FAILED"; exit 3; }
if [ -n "$PATCH" ] && [ -s "$PATCH" ]; then
  git -C "$WT" apply --whitespace=nowarn --exclude=".guren/*" "$PATCH" || { echo "PATCH-APPLY-FAILED"; drop_start_state "$ARM" "$WT"; exit 3; }
fi
setup_app "$ARM" "$WT"
SUITE_EXTRAS=1 "$SUITE/run.sh" "$ARM" "$WT" "$TASK" "$PORT" 2>&1
drop_start_state "$ARM" "$WT"
