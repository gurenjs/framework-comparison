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
# Sibling checkouts of agents-on-guren (tasks, references) and agents-on-guren-app (the Guren base).
AOG_ROOT="${AOG_ROOT:-$REPO_ROOT/../agents-on-guren}"
GUREN_APP_REPO="${GUREN_APP_REPO:-$REPO_ROOT/../agents-on-guren-app}"
GUREN_BASE="${GUREN_BASE:-0fd1654}"
VOID_REF="${VOID_REF:-HEAD}"
WT_ROOT="${WT_ROOT:-/tmp/ve-worktrees}"
RESULTS="${RESULTS:-$VE_ROOT/results}"
GIT_ID=(-c user.name=ve -c user.email=ve@example.invalid)

# Void needs Node >= 24.21; both arms get the same PATH so the only
# difference between them is the app.
export NODE24_BIN="${NODE24_BIN:-$(mise where node@24.22.0 2>/dev/null)/bin}"
export PATH="$NODE24_BIN:$PATH"

cell_id() { echo "$1/$2-$3-$4"; }   # <task> <arm> <model> <trial>

# resolve_arm <arm label>: `guren-<variant>` is the guren arm with the harness
# overlay overlays/guren-harness-<variant>/ (GUREN_TEMPLATE_OVERLAY), except
# `guren-shipped` (no overlay, a label of its own beside round 2's `guren`), so a
# before/after pair alternates inside one matrix. Sets ARM; the label stays the cell id.
resolve_arm() {
  ARM="$1"
  case "$1" in
    guren-shipped) ARM=guren ;;   # what agent:init installs from the base's own CLI, no overlay
    guren-*)
      ARM=guren
      GUREN_TEMPLATE_OVERLAY="$VE_ROOT/overlays/guren-harness-${1#guren-}"
      [ -d "$GUREN_TEMPLATE_OVERLAY" ] || { echo "no overlay for arm $1"; return 1; }
      export GUREN_TEMPLATE_OVERLAY ;;
  esac
}

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
      # refreshes the pin by hand: copy the two files back). GUREN_UPDATE=none
      # keeps the base's own lock, for a base scaffolded on the releases being
      # measured (eval/v2310: create-guren-app 1.19.0, @guren/cli 2.32.0).
      if [ "${GUREN_UPDATE:-pinned}" = none ]; then
        :
      elif [ "${GUREN_UPDATE:-pinned}" = live ]; then
        (cd "$dest" && bun update >/dev/null 2>&1) || { echo "BUN-UPDATE-FAILED"; return 1; }
      else
        cp "$VE_ROOT/harness/guren-pinned/package.json" "$VE_ROOT/harness/guren-pinned/bun.lock" "$dest/"
      fi
      git -C "$dest" add -A && git -C "$dest" "${GIT_ID[@]}" commit -q --allow-empty -m "harness: current @guren/* releases" --no-verify
      # A void-eval task may carry its own Guren seed (tasks/<id>-authz: a defect the statement never names).
      local seed="$AOG_ROOT/tasks/$task/seed.patch"
      [ -f "$VE_ROOT/tasks/$task/seed.guren.patch" ] && seed="$VE_ROOT/tasks/$task/seed.guren.patch"
      if [ -f "$seed" ]; then
        git -C "$dest" apply --whitespace=nowarn "$seed" || { echo "SEED-APPLY-FAILED"; return 1; }
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

# guren_agent_init <dir>: what `agent:init` installs from the CLI in node_modules.
# GUREN_TEMPLATE_OVERLAY=<dir> first copies that tree over the installed CLI's
# templates/agent/ (a harness change measured on the pinned CLI, nothing else
# moved). Files are replaced, not written through: bun may hardlink its cache.
guren_agent_init() {
  local app="$1"
  if [ -n "${GUREN_TEMPLATE_OVERLAY:-}" ]; then
    local dest="$app/node_modules/@guren/cli/templates/agent"
    [ -d "$dest" ] || { echo "OVERLAY: no $dest"; return 1; }
    (cd "$GUREN_TEMPLATE_OVERLAY" && find . -type f) | while read -r f; do
      mkdir -p "$(dirname "$dest/$f")"; rm -f "$dest/$f"; cp "$GUREN_TEMPLATE_OVERLAY/$f" "$dest/$f"
    done
  fi
  (cd "$app" && bunx guren agent:init --target claude >/dev/null 2>&1)
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
  # GUREN_PREAMBLE=typecheck-only gives Guren the Void arm's definition of done
  # (typecheck only, no request for tests); Void's preamble never changes.
  local pre="$VE_ROOT/harness/PREAMBLE.$arm.md"
  [ "$arm" = guren ] && [ -n "${GUREN_PREAMBLE:-}" ] && pre="$VE_ROOT/harness/PREAMBLE.guren.$GUREN_PREAMBLE.md"
  cat "$pre"
  echo
  cat "$VE_ROOT/tasks/$task/statement.$arm.md"
}
