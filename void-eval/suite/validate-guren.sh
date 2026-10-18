#!/usr/bin/env bash
# validate-guren.sh [task...]
#
# Validation gate for the Guren driver, on the same start state the harness
# gives agents (harness/lib.sh make_start_state guren: 0fd1654, `bun update`
# to the current @guren/* releases, the task's seed.patch):
#   start state                         -> suite must FAIL
#   start state + reference.patch       -> suite must PASS
# each RUNS times (default 2). reference.patch comes from agents-on-guren.
set -uo pipefail

SUITE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VE="$(cd "$SUITE/.." && pwd)"
RUNS="${RUNS:-2}"
PORT="${SUITE_PORT:-4100}"
TASKS=("$@")
[ ${#TASKS[@]} -gt 0 ] || TASKS=(missing-authorize-destroy pagination-skips-page raw-body-no-validation api-posts-contract)

source "$VE/harness/lib.sh"
LOGDIR="${LOGDIR:-/tmp/suite-validate-guren-logs}"; mkdir -p "$LOGDIR"
SUMMARY=()
BAD=0

run_phase() { # <task> <phase> <dir> <expect pass|fail>
  local task="$1" phase="$2" wt="$3" expect="$4" i rc got
  for i in $(seq 1 "$RUNS"); do
    SUITE_EXTRAS=1 "$SUITE/run.sh" guren "$wt" "$task" "$PORT" >"$LOGDIR/$task.$phase.$i.log" 2>&1
    rc=$?
    if [ $rc -eq 0 ]; then got=pass; elif [ $rc -eq 1 ]; then got=fail; else got="error($rc)"; fi
    local tally; tally="$(sed '/^--- extra/,$d' "$LOGDIR/$task.$phase.$i.log" | grep -E '^ *[0-9]+ (pass|fail)$' | tr -s ' ' | tr '\n' ' ')"
    local verdict=OK; [ "$got" = "$expect" ] || { verdict=UNEXPECTED; BAD=1; }
    echo "$task  $phase  run$i  -> $got [$tally] (expected $expect) $verdict"
    SUMMARY+=("$task|$phase|run$i|$got|$verdict")
  done
}

for task in "${TASKS[@]}"; do
  wt="$WT_ROOT/suite-guren-$task"
  make_start_state guren "$task" "$wt" >/dev/null || { echo "$task: start state failed"; BAD=1; continue; }
  setup_app guren "$wt"
  run_phase "$task" start "$wt" fail
  # codegen rewrites tracked .guren/*.gen.ts; restore them so a reference
  # that touches generated files applies cleanly.
  git -C "$wt" checkout -- .guren 2>/dev/null || true
  git -C "$wt" apply --whitespace=nowarn "$AOG_ROOT/tasks/$task/reference.patch" || { echo "$task: reference apply failed"; BAD=1; drop_start_state guren "$wt"; continue; }
  # boot-guren.sh reuses an existing vite build; the reference may add or
  # change pages, so force a rebuild for this phase.
  SUITE_REBUILD=1 run_phase "$task" reference "$wt" pass
  drop_start_state guren "$wt"
done

echo
echo "summary:"; printf '  %s\n' "${SUMMARY[@]}"
exit $BAD
