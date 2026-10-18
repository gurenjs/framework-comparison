#!/usr/bin/env bash
# validate-guren.sh [task...]
#
# Validation gate for the Guren driver: for each task, in a throwaway git
# worktree of the app repo at the baseline commit,
#   seeded            (seed.patch applied if the task has one)  -> suite must FAIL
#   seeded+reference  (reference.patch applied on top)          -> suite must PASS
# each run RUNS times (default 2). Prints one line per run and a summary.
# Worktrees live under /tmp/suite-wt-<task> and are removed afterwards.
set -uo pipefail

SUITE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BENCH="${BENCH_ROOT:-$HOME/Development/agents-on-guren}"
APP_REPO="${APP_REPO:-$HOME/Development/agents-on-guren-app}"
BASE="${BASE_COMMIT:-0fd1654}"
RUNS="${RUNS:-2}"
PORT="${SUITE_PORT:-4100}"
TASKS=("$@")
[ ${#TASKS[@]} -gt 0 ] || TASKS=(missing-authorize-destroy pagination-skips-page raw-body-no-validation api-posts-contract)

source "$BENCH/harness/lib.sh"   # setup_app
LOGDIR="${LOGDIR:-/tmp/suite-validate-logs}"; mkdir -p "$LOGDIR"
SUMMARY=()
BAD=0

run_phase() { # <task> <phase> <worktree> <expect pass|fail>
  local task="$1" phase="$2" wt="$3" expect="$4" i rc got
  for i in $(seq 1 "$RUNS"); do
    SUITE_EXTRAS=1 "$SUITE/run.sh" guren "$wt" "$task" "$PORT" >"$LOGDIR/$task.$phase.$i.log" 2>&1
    rc=$?
    if [ $rc -eq 0 ]; then got=pass; elif [ $rc -eq 1 ]; then got=fail; else got="error($rc)"; fi
    local tally; tally="$(sed '/^--- extra/,$d' "$LOGDIR/$task.$phase.$i.log" | grep -E '^ *[0-9]+ (pass|fail)$' | tr -s ' ' | tr '\n' ' ')"
    local verdict=OK; [ "$got" = "$expect" ] || { verdict=UNEXPECTED; BAD=1; }
    local extra; extra="$(grep -E "^--- extra exit" "$LOGDIR/$task.$phase.$i.log" | sed "s/--- extra exit: /extras-exit=/" | tr "\n" " ")"
    echo "$task  $phase  run$i  -> $got [$tally] (expected $expect) $verdict $extra"
    SUMMARY+=("$task|$phase|run$i|$got|$verdict")
  done
}

for task in "${TASKS[@]}"; do
  tdir="$BENCH/tasks/$task"
  wt="/tmp/suite-wt-$task"
  git -C "$APP_REPO" worktree remove --force "$wt" 2>/dev/null; rm -rf "$wt"; git -C "$APP_REPO" worktree prune
  git -C "$APP_REPO" worktree add --detach "$wt" "$BASE" >/dev/null 2>&1 || { echo "$task: worktree failed"; BAD=1; continue; }
  if [ -f "$tdir/seed.patch" ] && [ -s "$tdir/seed.patch" ]; then
    git -C "$wt" apply --whitespace=nowarn "$tdir/seed.patch" || { echo "$task: seed apply failed"; BAD=1; continue; }
  fi
  ( setup_app "$wt" )
  run_phase "$task" seeded "$wt" fail

  # codegen (setup_app/boot) rewrites tracked .guren/*.gen.ts; restore them so
  # reference patches that touch generated files apply cleanly.
  git -C "$wt" checkout -- .guren 2>/dev/null || true
  git -C "$wt" apply --whitespace=nowarn "$tdir/reference.patch" || { echo "$task: reference apply failed"; BAD=1; continue; }
  run_phase "$task" reference "$wt" pass

  git -C "$APP_REPO" worktree remove --force "$wt" 2>/dev/null || rm -rf "$wt"
  git -C "$APP_REPO" worktree prune
done

echo
echo "summary:"; printf '  %s\n' "${SUMMARY[@]}"
exit $BAD
