#!/bin/bash
# Usage: smoke-trial.sh <impl> <app-dir>
#
# Hidden functional-acceptance smoke for the agent-eval harness (round 2).
# The agent never sees this file. <app-dir> is a worktree copy of the
# implementation with the agent's patch applied and set up exactly like
# verify-trial.sh leaves it (deps installed, .env in place, migrations run
# where setup runs them).
#
# What it does:
#   1. Boots the app on a free port (each impl's own way). Booting first
#      matters for hono/nestjs/tanstack, which run their Drizzle migrations
#      at process start / first request — including the agent's tags
#      migration.
#   2. Seeds SQLite directly (sqlite3 CLI): one user, two posts by that user,
#      one tag `smoketag` attached to post #1 only. TASK.md pins the table
#      names `tags` (unique name) and `post_tags`; the join-table COLUMN
#      names are the agent's choice, so they are introspected via
#      PRAGMA table_info (any column containing "post" -> post FK, any other
#      containing "tag" -> tag FK). NOT NULL columns without a SQL-level
#      default are auto-filled by declared type (INT -> epoch seconds,
#      otherwise an ISO-8601 string), which covers every timestamp style in
#      the six implementations.
#   3. Asserts filtering through the user-visible surface:
#        SSR impls (guren /posts, nextjs /, tanstack /, adonisjs /posts):
#        the HTML (incl. Inertia data-page / TanStack hydration payload).
#        SPA impls (hono, nestjs): their JSON list API /api/posts.
#      Three cases: ?tag=smoketag -> post #1 only; no param -> both;
#      ?tag=nosuchtag -> neither. If the agent named the query param
#      something other than `tag`, the smoke fails — TASK.md pinned `?tag=`.
#   4. Kills the server (PID file + lsof on the port) and prints
#      `SMOKE PASS <impl>` (exit 0) or `SMOKE FAIL <impl>: <reason>` (exit 1).
#
# Per-impl matrix (base-schema facts; tags/post_tags introspected at runtime):
#   impl     | db file            | list URL   | posts author col | timestamps
#   guren    | data/guren.db      | /posts     | user_id          | TEXT ISO, NOT NULL
#   hono     | minilog.db         | /api/posts | author_id        | INT epoch, NOT NULL no default
#   nextjs   | minilog.db         | /          | author_id        | INT epoch, DEFAULT unixepoch()
#   tanstack | minilog.db         | /          | author_id        | INT epoch, DEFAULT unixepoch()
#   adonisjs | tmp/db.sqlite3     | /posts     | user_id          | datetime, created_at NOT NULL
#   nestjs   | minilog.db         | /api/posts | author_id        | INT epoch, NOT NULL no default
set -uo pipefail

IMPL="${1:-}"
APP_ARG="${2:-}"
if [ -z "$IMPL" ] || [ -z "$APP_ARG" ]; then
  echo "usage: smoke-trial.sh <impl> <app-dir>"
  exit 1
fi

fail() {
  echo "SMOKE FAIL $IMPL: $*"
  exit 1
}

APP="$(cd "$APP_ARG" 2>/dev/null && pwd)" || fail "app dir not found: $APP_ARG"
command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 CLI not found on PATH"

T1="SmokeAlphaPost9101"
T2="SmokeBetaPost9102"
TAG="smoketag"
NOTAG="nosuchtag"

LOG="$(mktemp /tmp/smoke-trial.log.XXXXXX)" || fail "mktemp failed"
PIDFILE="$(mktemp /tmp/smoke-trial.pid.XXXXXX)" || fail "mktemp failed"
SERVER_PID=""
PORT=""

cleanup() {
  if [ -f "$PIDFILE" ] && [ -s "$PIDFILE" ]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
  fi
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  sleep 1
  if [ -n "$SERVER_PID" ]; then
    kill -9 "$SERVER_PID" 2>/dev/null || true
  fi
  if [ -n "$PORT" ]; then
    lsof -ti:"$PORT" 2>/dev/null | xargs kill 2>/dev/null || true
    sleep 1
    lsof -ti:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
  fi
  rm -f "$PIDFILE"
}
trap cleanup EXIT

# ---------- per-impl configuration -------------------------------------------
case "$IMPL" in
  guren)    DB="$APP/data/guren.db";   LIST_PATH="/posts" ;;
  hono)     DB="$APP/minilog.db";      LIST_PATH="/api/posts" ;;
  nextjs)   DB="$APP/minilog.db";      LIST_PATH="/" ;;
  tanstack) DB="$APP/minilog.db";      LIST_PATH="/" ;;
  adonisjs) DB="$APP/tmp/db.sqlite3";  LIST_PATH="/posts"
            export PATH="$(/opt/homebrew/bin/mise where node@24.18.0)/bin:$PATH" ;;
  nestjs)   DB="$APP/minilog.db";      LIST_PATH="/api/posts" ;;
  *) fail "unknown impl: $IMPL" ;;
esac

# ---------- free port ---------------------------------------------------------
for p in $(seq 4310 4399); do
  if ! lsof -ti:"$p" >/dev/null 2>&1; then PORT="$p"; break; fi
done
[ -n "$PORT" ] || fail "no free port in 4310-4399"
# "localhost" (not 127.0.0.1): vite/node may bind IPv6 ::1 only; curl tries both.
BASE="http://localhost:$PORT"

# ---------- boot --------------------------------------------------------------
cd "$APP" || fail "cannot cd into $APP"
case "$IMPL" in
  guren)    PORT="$PORT" HOST=127.0.0.1 bun bin/serve.ts        >"$LOG" 2>&1 & ;;
  hono)     PORT="$PORT" bun src/server/index.ts                >"$LOG" 2>&1 & ;;
  nextjs)   npx next dev -p "$PORT"                             >"$LOG" 2>&1 & ;;
  tanstack) npx vite dev --port "$PORT" --strictPort            >"$LOG" 2>&1 & ;;
  adonisjs) PORT="$PORT" node ace serve                         >"$LOG" 2>&1 & ;;
  nestjs)   PORT="$PORT" npm run start                          >"$LOG" 2>&1 & ;;
esac
SERVER_PID=$!
echo "$SERVER_PID" > "$PIDFILE"

READY_TIMEOUT=180
ready=""
for _ in $(seq 1 "$READY_TIMEOUT"); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE$LIST_PATH" 2>/dev/null)
  if [ -n "$code" ] && [ "$code" != "000" ] && [ "$code" -lt 500 ]; then ready=1; break; fi
  kill -0 "$SERVER_PID" 2>/dev/null || fail "server process exited during boot (last log lines: $(tail -3 "$LOG" | tr '\n' ' '))"
  sleep 1
done
[ -n "$ready" ] || fail "server not ready on $BASE$LIST_PATH after ${READY_TIMEOUT}s (last log lines: $(tail -3 "$LOG" | tr '\n' ' '))"

# ---------- seed --------------------------------------------------------------
[ -f "$DB" ] || fail "database file not found at $DB"

# generic_insert <table> <col=sql-literal> ...
# Fills any remaining NOT NULL, non-PK, no-default column by declared type.
generic_insert() {
  local table="$1"; shift
  local cols="" vals="" assigned=" " kv name
  for kv in "$@"; do
    name="${kv%%=*}"
    cols="$cols,\"$name\""
    vals="$vals,${kv#*=}"
    assigned="$assigned$name "
  done
  while IFS='|' read -r _cid cname ctype cnotnull cdflt cpk; do
    case "$assigned" in *" $cname "*) continue ;; esac
    [ "$cnotnull" = "1" ] || continue
    [ -n "$cdflt" ] && continue
    [ "$cpk" != "0" ] && continue
    case "$(printf '%s' "$ctype" | tr '[:lower:]' '[:upper:]')" in
      *INT*) cols="$cols,\"$cname\""; vals="$vals,1700000000" ;;
      *)     cols="$cols,\"$cname\""; vals="$vals,'2026-01-01T00:00:00.000Z'" ;;
    esac
  done < <(sqlite3 "$DB" "PRAGMA table_info(\"$table\");")
  sqlite3 "$DB" "INSERT INTO \"$table\" (${cols#,}) VALUES (${vals#,});" \
    || fail "insert into $table failed"
}

# TASK.md pins the table names; without them the feature can't be seeded.
tagcount=$(sqlite3 "$DB" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('tags','post_tags');") \
  || fail "could not read sqlite_master in $DB"
[ "$tagcount" = "2" ] || fail "tables 'tags' and 'post_tags' not both present in $DB — the agent's schema does not match TASK.md (found $tagcount of 2)"
sqlite3 "$DB" "SELECT name FROM pragma_table_info('tags') WHERE name='name';" | grep -q name \
  || fail "tags table has no 'name' column"

# Join-table column names are the agent's choice — introspect and adapt.
PT_POST=$(sqlite3 "$DB" "PRAGMA table_info('post_tags');" | awk -F'|' 'tolower($2) ~ /post/ {print $2; exit}')
PT_TAG=$(sqlite3 "$DB" "PRAGMA table_info('post_tags');" | awk -F'|' 'tolower($2) ~ /tag/ && tolower($2) !~ /post/ {print $2; exit}')
if [ -z "$PT_POST" ] || [ -z "$PT_TAG" ]; then
  fail "could not identify post/tag FK columns in post_tags (columns: $(sqlite3 "$DB" "PRAGMA table_info('post_tags');" | awk -F'|' '{printf "%s ", $2}'))"
fi

# Idempotent: clear any rows from a previous smoke run first.
sqlite3 "$DB" "DELETE FROM post_tags WHERE \"$PT_POST\" IN (9101,9102);
DELETE FROM tags WHERE name='$TAG';
DELETE FROM posts WHERE id IN (9101,9102);
DELETE FROM users WHERE id=9001;" || fail "pre-seed cleanup failed"

case "$IMPL" in
  guren)
    generic_insert users id=9001 name="'Smoke User'" email="'smoke9001@example.com'" password_hash="'smokehash'"
    generic_insert posts id=9101 user_id=9001 title="'$T1'" body="'smoke body one'"
    generic_insert posts id=9102 user_id=9001 title="'$T2'" body="'smoke body two'"
    ;;
  adonisjs)
    generic_insert users id=9001 full_name="'Smoke User'" email="'smoke9001@example.com'" password="'smokehash'"
    generic_insert posts id=9101 user_id=9001 title="'$T1'" body="'smoke body one'"
    generic_insert posts id=9102 user_id=9001 title="'$T2'" body="'smoke body two'"
    ;;
  *)
    generic_insert users id=9001 name="'Smoke User'" email="'smoke9001@example.com'" password_hash="'smokehash'"
    generic_insert posts id=9101 author_id=9001 title="'$T1'" body="'smoke body one'"
    generic_insert posts id=9102 author_id=9001 title="'$T2'" body="'smoke body two'"
    ;;
esac

generic_insert tags id=9201 name="'$TAG'"
generic_insert post_tags "$PT_POST=9101" "$PT_TAG=9201"

# ---------- assert ------------------------------------------------------------
# assert_case <url> <expect-post1 yes|no> <expect-post2 yes|no> <label>
assert_case() {
  local url="$1" e1="$2" e2="$3" label="$4" body h1=no h2=no
  # tr -d '\0': some SSR streams embed null bytes, which bash command
  # substitution warns about and drops anyway.
  body=$(curl -s --max-time 90 "$url" | tr -d '\0') || fail "$label: curl failed ($url)"
  printf '%s' "$body" | grep -qF "$T1" && h1=yes
  printf '%s' "$body" | grep -qF "$T2" && h2=yes
  if [ "$h1" != "$e1" ] || [ "$h2" != "$e2" ]; then
    fail "$label: expected post1=$e1 post2=$e2 but got post1=$h1 post2=$h2 ($url)"
  fi
}

assert_case "$BASE$LIST_PATH"             yes yes "unfiltered list"
assert_case "$BASE$LIST_PATH?tag=$TAG"    yes no  "filtered list ?tag=$TAG"
assert_case "$BASE$LIST_PATH?tag=$NOTAG"  no  no  "filtered list ?tag=$NOTAG"

echo "SMOKE PASS $IMPL"
exit 0
