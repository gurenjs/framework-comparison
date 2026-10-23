#!/usr/bin/env bash
# check-public.sh [--rev <commit>] [<rev range>]
#
# Fails when a tracked file (or, with a range, a commit message in it) carries
# something that must not be published: local absolute paths, Claude Code
# session data, credentials or personal mail addresses. Run by .githooks/pre-push
# and by the public-check workflow on every pull request.
#
# Results written by the eval harnesses go through
# void-eval/harness/sanitize-results.py, which removes what this check looks for.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 2

# --rev scans that commit's tree instead of the working copy (the pre-push hook's case).
REV=()
if [ "${1:-}" = --rev ]; then REV=("$2"); shift 2; fi

PATTERN='/Users/[A-Za-z0-9._-]+/'                                   # macOS home
PATTERN+='|/home/[a-z][a-z0-9_-]*/'                                 # Linux home
PATTERN+='|/private/(tmp|var)/[A-Za-z0-9]|/var/folders/[A-Za-z0-9]' # macOS temp dirs
PATTERN+='|~/Development|\$HOME/Development'                        # a personal checkout layout
PATTERN+='|"session_id"|"slash_commands"|"memory_paths"|toolu_[A-Za-z0-9]{10,}'  # Claude Code session data
PATTERN+='|side-session-notes|local_[0-9a-f]{8}-[0-9a-f]{4}'        # Claude Code session notes and ids
PATTERN+='|sk-ant-[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|github_pat_|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY'
PATTERN+='|[A-Za-z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|icloud)\.com'

# The patterns themselves live in these files.
EXCLUDE=(':!scripts/check-public.sh' ':!void-eval/harness/sanitize-results.py'
         ':!*.lock' ':!*lock.yaml' ':!*lock.json')

status=0
# git grep: 0 = hits, 1 = none, anything else = the scan did not run, which is not a pass.
hits="$(git grep -nIE "$PATTERN" ${REV[@]+"${REV[@]}"} -- . "${EXCLUDE[@]}")"
case $? in
  0) echo "check-public: tracked files carry data that must not be published:"
     echo "$hits" | cut -c1-200
     status=1 ;;
  1) ;;
  *) echo "check-public: git grep failed"; exit 2 ;;
esac
if [ -n "${1:-}" ]; then
  log="$(git log --format='%h %B' "$1")" || { echo "check-public: cannot read commits in $1 (fetch first?)"; exit 2; }
  if msgs="$(printf '%s\n' "$log" | grep -nE "$PATTERN")"; then
    echo "check-public: commit messages in $1 carry data that must not be published:"
    echo "$msgs" | cut -c1-200
    status=1
  fi
fi
[ $status -eq 0 ] && echo "check-public: ok"
exit $status
