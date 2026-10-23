#!/bin/bash
# Round 4 (2026-10-20): more hidden defects on Haiku 5.5 (delete authorization, which
# guren audit reads; the edit page's GET and a mass-assignable authorId, which it does
# not: the controls), then round 3's update-authz tasks and post-tags-mass on Sonnet 5.5. Void vs Guren v4. Stops past $SPEND_CAP.
cd "$(dirname "$0")/.."
export GUREN_BASE=c0a533c GUREN_PREAMBLE=typecheck-only
CAP="${SPEND_CAP:-12}"
spent() { python3 -I harness/spend.py results-round4; }
over() { python3 -I -c "import sys; sys.exit(0 if $(spent) > $CAP else 1)"; }
run() { # <task> <model>
  over && { echo "STOP: spend $(spent) > $CAP"; exit 3; }
  env RESULTS=$PWD/results-round4 bash harness/run-matrix.sh --tasks "$1" --arms void,guren-v4 --models "$2" --trials 3
}
for task in post-tags-dauthz post-revisions-dauthz comments-moderation-dauthz post-tags-eauthz scheduled-publish-eauthz post-tags-mass; do run $task claude-haiku-5-5; done
echo "== haiku done, spend $(spent)"
for task in post-tags-authz post-revisions-authz scheduled-publish-authz post-tags-mass; do run $task claude-sonnet-5-5; done
echo "== done, spend $(spent)"
