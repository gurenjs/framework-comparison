#!/usr/bin/env bash
# HTTP benchmark: guren/ vs adonisjs/ serving the same Minilog app.
#
# Prerequisites:
#   - oha (https://github.com/hatoo/oha)
#   - Both apps built and both DBs migrated + seeded (see BENCHMARK.md / bench.yml)
#
# Env:
#   RUNS=5                 measurement rounds per scenario (default 3)
#   DURATION=10s           oha duration per round
#   CONCURRENCY=50         oha connections
#   ADONIS_NODE="node"     node launcher; locally use "mise exec node@24 -- node"
#
# Outputs: bench-results.csv (raw rounds), bench-summary.md (medians + ratios)
set -euo pipefail
cd "$(dirname "$0")/.."

RUNS=${RUNS:-3}
DURATION=${DURATION:-10s}
CONCURRENCY=${CONCURRENCY:-50}
GUREN_PORT=${GUREN_PORT:-4101}
ADONIS_PORT=${ADONIS_PORT:-4102}
ADONIS_NODE=${ADONIS_NODE:-node}
CSV=bench-results.csv
SUMMARY=bench-summary.md

cleanup() {
  pkill -f "bun bin/serve.ts" 2>/dev/null || true
  pkill -f "node bin/server.js" 2>/dev/null || true
}
trap cleanup EXIT
cleanup
sleep 1

now_ms() { python3 -c 'import time; print(int(time.time()*1000))'; }

wait_ready() { # url
  for _ in $(seq 1 600); do
    curl -sf -o /dev/null -m 1 "$1" && return 0
    sleep 0.02
  done
  echo "server at $1 never became ready" >&2
  exit 1
}

echo "framework,scenario,run,rps,p50_ms,p99_ms,status_200" > "$CSV"

START=$(now_ms)
(cd guren && NODE_ENV=production PORT=$GUREN_PORT bun bin/serve.ts > /tmp/bench-guren.log 2>&1 &)
wait_ready "http://127.0.0.1:$GUREN_PORT/posts"
GUREN_COLD=$(( $(now_ms) - START ))

START=$(now_ms)
(cd adonisjs/build && NODE_ENV=production PORT=$ADONIS_PORT HOST=127.0.0.1 \
  $ADONIS_NODE bin/server.js > /tmp/bench-adonis.log 2>&1 &)
wait_ready "http://127.0.0.1:$ADONIS_PORT/posts"
ADONIS_COLD=$(( $(now_ms) - START ))

# Inertia asset versions (required for the JSON scenario; mismatch returns 409)
GV=$(curl -s "http://127.0.0.1:$GUREN_PORT/posts" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
AV=$(curl -s "http://127.0.0.1:$ADONIS_PORT/posts" | grep -o 'version&quot;:&quot;[^&]*' | head -1 | sed 's/.*quot;:&quot;//')

bench() { # framework scenario run url [headers...]
  local fw=$1 sc=$2 run=$3 url=$4
  shift 4
  oha -z "$DURATION" -c "$CONCURRENCY" --no-tui --output-format json "$@" "$url" 2>/dev/null \
    | python3 -c "
import json, sys
d = json.load(sys.stdin)
s = d['summary']
lat = d['latencyPercentiles']
codes = d['statusCodeDistribution']
print(f\"$fw,$sc,$run,{s['requestsPerSec']:.1f},{lat['p50']*1000:.2f},{lat['p99']*1000:.2f},{codes.get('200', 0)}\")" \
    | tee -a "$CSV"
}

# Warmup (discarded)
oha -z 5s -c 25 --no-tui --output-format quiet "http://127.0.0.1:$GUREN_PORT/posts" > /dev/null 2>&1
oha -z 5s -c 25 --no-tui --output-format quiet "http://127.0.0.1:$ADONIS_PORT/posts" > /dev/null 2>&1

echo "runs=$RUNS duration=$DURATION concurrency=$CONCURRENCY"
for run in $(seq 1 "$RUNS"); do
  # Interleaved so runner noise lands on both frameworks equally.
  bench guren  html "$run" "http://127.0.0.1:$GUREN_PORT/posts"
  bench adonis html "$run" "http://127.0.0.1:$ADONIS_PORT/posts"
  bench guren  json "$run" "http://127.0.0.1:$GUREN_PORT/posts" -H "X-Inertia: true" -H "X-Inertia-Version: $GV"
  bench adonis json "$run" "http://127.0.0.1:$ADONIS_PORT/posts" -H "X-Inertia: true" -H "X-Inertia-Version: $AV"
done

GUREN_COLD=$GUREN_COLD ADONIS_COLD=$ADONIS_COLD CSV=$CSV \
DURATION=$DURATION CONCURRENCY=$CONCURRENCY RUNS=$RUNS \
BUN_V=$(bun --version) NODE_V=$($ADONIS_NODE --version) \
python3 - > "$SUMMARY" <<'PY'
import csv, os, platform
from statistics import median

rows = list(csv.DictReader(open(os.environ['CSV'])))
def med(fw, sc, key):
    return median(float(r[key]) for r in rows if r['framework'] == fw and r['scenario'] == sc)

print('# guren vs adonisjs — same app, Bun vs Node\n')
print(f"{os.environ['RUNS']} rounds × {os.environ['DURATION']} at {os.environ['CONCURRENCY']} connections, "
      f"interleaved, medians reported. Host: {platform.platform()}.")
print(f"Bun {os.environ['BUN_V']} / Node {os.environ['NODE_V']}\n")
print('| Scenario | Guren (Bun) | AdonisJS (Node) | Ratio |')
print('|----------|-------------|-----------------|-------|')
for sc, label in [('html', 'GET /posts — SSR HTML'), ('json', 'GET /posts — Inertia JSON')]:
    g, a = med('guren', sc, 'rps'), med('adonis', sc, 'rps')
    print(f"| {label} — req/s | {g:,.0f} | {a:,.0f} | **{g/a:.1f}×** |")
    print(f"| {label} — p50 / p99 | {med('guren', sc, 'p50_ms'):.1f} / {med('guren', sc, 'p99_ms'):.1f} ms "
          f"| {med('adonis', sc, 'p50_ms'):.1f} / {med('adonis', sc, 'p99_ms'):.1f} ms | |")
gc, ac = int(os.environ['GUREN_COLD']), int(os.environ['ADONIS_COLD'])
print(f"| Cold start → first 200 | {gc} ms | {ac} ms | {ac/gc:.1f}× |")
print('\nAbsolute numbers depend on the host; the ratio is the claim. '
      'Raw rounds: bench-results.csv.')
PY

cat "$SUMMARY"
