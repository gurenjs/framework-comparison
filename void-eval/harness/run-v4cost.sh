#!/bin/bash
# Harness v4 cost on round-2 conditions (lean base, typecheck-only DoD), Sonnet 5.5, 15 cells.
cd "$(dirname "$0")/.."
export GUREN_BASE=c0a533c GUREN_PREAMBLE=typecheck-only
for task in post-tags comments-moderation post-revisions json-api-tokens scheduled-publish; do
  env RESULTS=$PWD/results-round2 bash harness/run-matrix.sh --tasks $task --arms guren-v4 --models claude-sonnet-5-5 --trials 3
done
