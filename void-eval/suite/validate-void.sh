#!/usr/bin/env bash
# validate-void.sh [task...]
#
# Validation gate for the Void driver, the twin of validate-guren.sh: for each
# task, a standalone copy of void-eval/app (harness/lib.sh make_start_state),
#   seeded            (seed.void.patch applied if the task has one) -> suite must FAIL
#   seeded+reference  (reference.void.patch applied on top)         -> suite must PASS
# each run RUNS times (default 2).
set -uo pipefail

SUITE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VE="$(cd "$SUITE/.." && pwd)"
RUNS="${RUNS:-2}"
PORT="${SUITE_PORT:-4200}"
TASKS=("$@")
[ ${#TASKS[@]} -gt 0 ] || TASKS=(missing-authorize-destroy pagination-skips-page raw-body-no-validation api-posts-contract)

source "$VE/harness/lib.sh"   # make_start_state, setup_app
LOGDIR="${LOGDIR:-/tmp/suite-validate-void-logs}"; mkdir -p "$LOGDIR"
SUMMARY=()
BAD=0

run_phase() { # <task> <phase> <dir> <expect pass|fail>
  local task="$1" phase="$2" wt="$3" expect="$4" i rc got
  for i in $(seq 1 "$RUNS"); do
    SUITE_EXTRAS=1 "$SUITE/run.sh" void "$wt" "$task" "$PORT" >"$LOGDIR/$task.$phase.$i.log" 2>&1
    rc=$?
    if [ $rc -eq 0 ]; then got=pass; elif [ $rc -eq 1 ]; then got=fail; else got="error($rc)"; fi
    local tally; tally="$(sed '/^--- extra/,$d' "$LOGDIR/$task.$phase.$i.log" | grep -E '^ *[0-9]+ (pass|fail)$' | tr -s ' ' | tr '\n' ' ')"
    local verdict=OK; [ "$got" = "$expect" ] || { verdict=UNEXPECTED; BAD=1; }
    echo "$task  $phase  run$i  -> $got [$tally] (expected $expect) $verdict"
    SUMMARY+=("$task|$phase|run$i|$got|$verdict")
  done
}

for task in "${TASKS[@]}"; do
  wt="$WT_ROOT/suite-void-$task"
  make_start_state void "$task" "$wt" >/dev/null || { echo "$task: start state failed"; BAD=1; continue; }
  setup_app void "$wt"
  run_phase "$task" seeded "$wt" fail
  git -C "$wt" apply --whitespace=nowarn "$VE/tasks/$task/reference.void.patch" || { echo "$task: reference apply failed"; BAD=1; continue; }
  run_phase "$task" reference "$wt" pass
  drop_start_state void "$wt"
done

echo
echo "summary:"; printf '  %s\n' "${SUMMARY[@]}"
exit $BAD
