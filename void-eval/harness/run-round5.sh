#!/bin/bash
# Round 5 (2026-10-23): harness v4's cost re-measured on today's template. Round 2's
# conditions (lean pages, typecheck-only definition of done, the five Stage 2 tickets),
# but the Guren app is create-guren-app 1.19.0 (agents-on-guren-app eval/v2310, lean:
# 525c19c) on its own lock (@guren/cli 2.32.0, which ships v4: no overlay). The old
# app's PostController.store force-write warning, which blocked 13 of round 2's 15 v4
# stops, is gone from this template. Sonnet 5.5, Guren only; Void reuses results/.
# Stops past $SPEND_CAP.
cd "$(dirname "$0")/.."
export GUREN_BASE=525c19c GUREN_UPDATE=none GUREN_PREAMBLE=typecheck-only
unset GUREN_TEMPLATE_OVERLAY
CAP="${SPEND_CAP:-10}"
spent() { python3 -I harness/spend.py results-round5; }
over() { python3 -I -c "import sys; sys.exit(0 if $(spent) > $CAP else 1)"; }
for task in post-tags comments-moderation post-revisions json-api-tokens scheduled-publish; do
  over && { echo "STOP: spend $(spent) > $CAP"; exit 3; }
  env RESULTS=$PWD/results-round5 bash harness/run-matrix.sh --tasks $task --arms guren-shipped --models claude-sonnet-5-5 --trials 3
done
echo "== done, spend $(spent)"
