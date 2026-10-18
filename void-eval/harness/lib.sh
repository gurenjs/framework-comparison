#!/bin/bash
# Shared helpers for the Guren-vs-Void agent eval. Source, don't execute.
#
# Arms:
#   guren — agents-on-guren-app at $GUREN_BASE (0fd1654, create-guren-app
#           1.17.2), the agents-on-guren task's seed.patch, then
#           `bunx guren agent:init --target claude` committed ("shipped").
#   void  — void-eval/app at $VOID_REF, extracted into a standalone repo (the
#           agent must not see the rest of this repository, suite included),
#           tasks/<id>/seed.void.patch committed. AGENTS.md and the
#           .claude/skills links are what `void init` installs.

VE_ROOT="${VE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
REPO_ROOT="$(cd "$VE_ROOT/.." && pwd)"
AOG_ROOT="${AOG_ROOT:-$HOME/Development/agents-on-guren}"
GUREN_APP_REPO="${GUREN_APP_REPO:-$HOME/Development/agents-on-guren-app}"
GUREN_BASE="${GUREN_BASE:-0fd1654}"
VOID_REF="${VOID_REF:-HEAD}"
WT_ROOT="${WT_ROOT:-/tmp/ve-worktrees}"
RESULTS="${RESULTS:-$VE_ROOT/results}"
GIT_ID=(-c user.name=ve -c user.email=ve@example.invalid)

# Void needs Node >= 24.21; both arms get the same PATH so the only
# difference between them is the app.
NODE24_BIN="${NODE24_BIN:-$(mise where node@24.22.0 2>/dev/null)/bin}"
export PATH="$NODE24_BIN:$PATH"

cell_id() { echo "$1/$2-$3-$4"; }   # <task> <arm> <model> <trial>

# make_start_state <arm> <task> <dest>: the seeded start state, committed.
make_start_state() {
  local arm="$1" task="$2" dest="$3"
  rm -rf "$dest"
  case "$arm" in
    guren)
      git -C "$GUREN_APP_REPO" worktree remove --force "$dest" 2>/dev/null || true
      git -C "$GUREN_APP_REPO" worktree prune
      git -C "$GUREN_APP_REPO" worktree add --detach "$dest" "$GUREN_BASE" >/dev/null || return 1
      # Move the app from 0fd1654's locked @guren/cli 2.27 to the releases this
      # round measured (RUNBOOK: `bun update` before an app arm). The result of
      # that update is pinned in harness/guren-pinned/ (package.json + bun.lock,
      # @guren/cli 2.31.1), so a cell and its later grading install the same
      # versions. GUREN_UPDATE=live runs a fresh `bun update` instead (and
      # refreshes the pin by hand: copy the two files back).
      if [ "${GUREN_UPDATE:-pinned}" = live ]; then
        (cd "$dest" && bun install --frozen-lockfile >/dev/null 2>&1 && bun update >/dev/null 2>&1) || { echo "BUN-UPDATE-FAILED"; return 1; }
      else
        cp "$VE_ROOT/harness/guren-pinned/package.json" "$VE_ROOT/harness/guren-pinned/bun.lock" "$dest/"
      fi
      git -C "$dest" add -A && git -C "$dest" "${GIT_ID[@]}" commit -q -m "harness: current @guren/* releases" --no-verify
      if [ -f "$AOG_ROOT/tasks/$task/seed.patch" ]; then
        git -C "$dest" apply --whitespace=nowarn "$AOG_ROOT/tasks/$task/seed.patch" || { echo "SEED-APPLY-FAILED"; return 1; }
        git -C "$dest" add -A && git -C "$dest" "${GIT_ID[@]}" commit -q -m "seed: $task" --no-verify
      fi
      ;;
    void)
      mkdir -p "$dest"
      git -C "$REPO_ROOT" archive "$VOID_REF" void-eval/app | tar -x -C "$dest" --strip-components=2 || return 1
      git -C "$dest" init -q && git -C "$dest" add -A && git -C "$dest" "${GIT_ID[@]}" commit -q -m "void-blog baseline ($(git -C "$REPO_ROOT" rev-parse --short "$VOID_REF"))"
      if [ -f "$VE_ROOT/tasks/$task/seed.void.patch" ]; then
        git -C "$dest" apply --whitespace=nowarn "$VE_ROOT/tasks/$task/seed.void.patch" || { echo "SEED-APPLY-FAILED"; return 1; }
        git -C "$dest" add -A && git -C "$dest" "${GIT_ID[@]}" commit -q -m "seed: $task" --no-verify
      fi
      ;;
    *) echo "unknown arm: $arm"; return 1 ;;
  esac
}

drop_start_state() {
  local arm="$1" dest="$2"
  cd / || true
  # Servers the agent (or the suite) left running from this directory.
  pkill -f "$dest/" 2>/dev/null || true; sleep 1; pkill -9 -f "$dest/" 2>/dev/null || true
  if [ "$arm" = guren ]; then
    git -C "$GUREN_APP_REPO" worktree remove --force "$dest" 2>/dev/null || rm -rf "$dest"
    git -C "$GUREN_APP_REPO" worktree prune
  else
    rm -rf "$dest"
  fi
}

# setup_app <arm> <dir>: dependencies, env, codegen, migrations.
setup_app() {
  local arm="$1" app="$2"
  (
    cd "$app" || exit 1
    case "$arm" in
      guren)
        bun install --frozen-lockfile >/dev/null 2>&1 || bun install >/dev/null 2>&1
        cp .env.example .env
        bunx guren key:generate --write >/dev/null 2>&1
        bun run codegen >/dev/null 2>&1
        bun run db:migrate >/dev/null 2>&1
        ;;
      void)
        pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1
        npx void prepare >/dev/null 2>&1
        ;;
    esac
  )
}

# typecheck <arm> <dir> <log>: the "typecheck passes" half of the pass gate.
typecheck() {
  local arm="$1" app="$2" log="$3"
  ( cd "$app" && case "$arm" in
      guren) bunx tsc --noEmit ;;
      void)  pnpm typecheck ;;
    esac ) > "$log" 2>&1
}

# The prompt = the arm's preamble + the arm's statement for the task.
build_prompt() {
  local arm="$1" task="$2"
  cat "$VE_ROOT/harness/PREAMBLE.$arm.md"
  echo
  cat "$VE_ROOT/tasks/$task/statement.$arm.md"
}
