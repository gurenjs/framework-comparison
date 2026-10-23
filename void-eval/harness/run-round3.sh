#!/bin/bash
# Round 3 (2026-10-19): hidden-defect cells on Haiku 5.5 (Void vs Guren v4), then the
# v3 cost cells on Sonnet 5.5 (same conditions as round 2). Stops past $SPEND_CAP of
# new spend (harness/spend.py, real per-model prices).
cd "$(dirname "$0")/.."
export GUREN_BASE=c0a533c GUREN_PREAMBLE=typecheck-only
CAP="${SPEND_CAP:-13}"
BASE2="$(python3 -I harness/spend.py results-round2)"
spent() { python3 -I -c "print(round($(python3 -I harness/spend.py results-round3 results-round2) - $BASE2, 2))"; }
over() { python3 -I -c "import sys; sys.exit(0 if $(spent) > $CAP else 1)"; }
for task in post-tags-authz post-revisions-authz scheduled-publish-authz; do
  over && { echo "STOP: spend $(spent) > $CAP"; exit 3; }
  env RESULTS=$PWD/results-round3 bash harness/run-matrix.sh --tasks $task --arms void,guren-v4 --models claude-haiku-5-5 --trials 3
done
echo "== haiku done, spend $(spent)"
for task in post-tags comments-moderation post-revisions json-api-tokens scheduled-publish; do
  over && { echo "STOP: spend $(spent) > $CAP"; exit 3; }
  env RESULTS=$PWD/results-round2 bash harness/run-matrix.sh --tasks $task --arms guren-v3 --models claude-sonnet-5-5 --trials 3
done
echo "== done, spend $(spent)"
