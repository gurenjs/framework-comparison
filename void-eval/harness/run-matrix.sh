#!/bin/bash
# Usage: run-matrix.sh --tasks a,b --arms guren,void --models m1 --trials N
# Trial-outermost, verify after each cell, resumable: a cell with a verdict is
# skipped, a cell with a stream but no verdict is verified only.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"
TASKS=""; ARMS="guren,void"; MODELS="claude-sonnet-5-5"; TRIALS=1
while [ $# -gt 0 ]; do case "$1" in
  --tasks) TASKS="$2"; shift 2;; --arms) ARMS="$2"; shift 2;;
  --models) MODELS="$2"; shift 2;; --trials) TRIALS="$2"; shift 2;;
  *) echo "unknown arg $1"; exit 2;; esac; done
IFS=, read -ra T <<<"$TASKS"; IFS=, read -ra A <<<"$ARMS"; IFS=, read -ra M <<<"$MODELS"
for trial in $(seq 1 "$TRIALS"); do for task in "${T[@]}"; do for model in "${M[@]}"; do for arm in "${A[@]}"; do
  out="$RESULTS/$(cell_id "$task" "$arm" "$model" "$trial")"
  if [ -f "$out.verdict.json" ] && ! grep -q BOOT-ERROR "$out.verdict.json"; then echo "skip $task $arm $model $trial"; continue; fi
  if [ ! -f "$out.patch" ]; then
    FORCE=1 bash "$HERE/run-cell.sh" "$task" "$arm" "$model" "$trial" || { echo "RUN FAILED $task $arm $model $trial"; continue; }
  fi
  bash "$HERE/verify-cell.sh" "$task" "$arm" "$model" "$trial"
done; done; done; done
