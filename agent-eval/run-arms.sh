#!/bin/bash
# Runs a list of arms (LABEL:IMPL:GUIDANCE:REF) trial-outermost, one cell at a time, verifying
# each cell right after it runs. Skips cells that already have a verdict, so it resumes.
# Edit ARMS and MODEL for the round; results land in results/<label>-<trial>.*.
set -uo pipefail
EVAL=~/Development/framework-comparison/agent-eval
cd "$EVAL" || exit 2
ARMS=("guren-cli228:guren:shipped:306824b")   # cli 2.28.0 re-run of the shipped arm; edit per round
echo "== partA start $(date '+%F %T') | load: $(uptime | sed 's/.*load averages*: *//') | df: $(df -h /System/Volumes/Data | tail -1 | awk '{print $4}') free"
for TRIAL in 1 2 3; do
  for ARM in "${ARMS[@]}"; do
    IFS=: read -r LABEL IMPL GUIDANCE REF <<< "$ARM"
    OUT="results/$LABEL-$TRIAL"
    if [ -f "$OUT.verdict.json" ] || grep -q "^$LABEL-$TRIAL[ :]" results/verdicts.txt 2>/dev/null; then echo "-- skip $LABEL-$TRIAL (verdict exists)"; continue; fi
    echo "== $(date '+%T') run $LABEL-$TRIAL (impl=$IMPL guidance=$GUIDANCE ref=$REF)"
    LABEL="$LABEL" GUIDANCE="$GUIDANCE" REF="$REF" MODEL="${MODEL:-claude-sonnet-5}" bash run-trial.sh "$IMPL" "$TRIAL" > "results/$LABEL-$TRIAL.driver-run.log" 2>&1
    RC=$?
    if [ $RC -ne 0 ]; then echo "!! run failed rc=$RC $LABEL-$TRIAL: $(tail -1 "results/$LABEL-$TRIAL.driver-run.log")"; fi
    if [ -f "$OUT.result.json" ] && python3 - "$OUT.result.json" <<'PY'
import json,sys
r=json.load(open(sys.argv[1]))
sys.exit(0 if r.get('is_error') and 'authenticate' in str(r.get('result','')) else 1)
PY
    then echo "!! auth error in $LABEL-$TRIAL; stopping the driver"; exit 3; fi
    echo "== $(date '+%T') verify $LABEL-$TRIAL"
    LABEL="$LABEL" REF="$REF" bash verify-trial.sh "$IMPL" "$TRIAL" > "results/$LABEL-$TRIAL.driver-verify.log" 2>&1
    echo "   verdict: $(grep "^$LABEL-$TRIAL[ :]" results/verdicts.txt 2>/dev/null | tail -1)"
    echo "   turns/cost: $(python3 -c "import json,sys;r=json.load(open(sys.argv[1]));print(r.get('num_turns'),r.get('total_cost_usd'))" "$OUT.result.json" 2>/dev/null)"
    echo "   df: $(df -h /System/Volumes/Data | tail -1 | awk '{print $4}') free | load: $(uptime | sed 's/.*load averages*: *//')"
  done
done
echo "== partA end $(date '+%F %T')"
