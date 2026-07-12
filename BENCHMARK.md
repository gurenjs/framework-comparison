# HTTP Benchmark: guren/ vs adonisjs/

Both implementations serve the **same app** ([SPEC.md](./SPEC.md) Minilog):
Inertia + React 19 SSR, SQLite, session middleware on every request. This is
deliberately *not* a hello-world benchmark — the request path exercises
routing, session handling, ORM pagination (Drizzle-backed models vs Lucid),
serialization, and React SSR. Since the app code is held constant, the
comparison is essentially **the same app on Bun vs on Node** — which is the
claim; phrase it that way, not as "framework X is slow".

**The ratio is the claim, not the absolute numbers.** Rounds are interleaved
(guren, adonis, guren, adonis, …) on the same host so environment noise lands
on both sides equally; medians across rounds are reported. Absolute req/s
depends entirely on the hardware.

## Scenarios

| Scenario | What it measures |
|----------|------------------|
| `GET /posts` (HTML) | Full SSR page: routing → session → ORM pagination (50 rows) → Inertia → React SSR |
| `GET /posts` (`X-Inertia` JSON) | Same path minus React SSR — the framework's "raw" request loop |

Load: `oha`, 5 s warmup, then N rounds of 10 s at 50 connections per
scenario, production builds, loopback. Both databases are seeded identically
(2 users, 50 posts, 100 comments) by [`scripts/bench-seed.ts`](./scripts/bench-seed.ts).

## Run it

**GitHub Actions (recommended):** the [`bench` workflow](./.github/workflows/bench.yml)
builds both apps, seeds the databases, runs the interleaved rounds, and prints
the summary table to the job summary (raw CSV attached as an artifact). Fork
the repo and press *Run workflow* to reproduce — no local setup, no cost.

**Locally:**

```bash
(cd guren && bun install && bun run build && mkdir -p data && bunx guren db:migrate)
(cd adonisjs && npm ci && node ace build && node ace migration:run --force \
  && cp .env build/.env && mkdir -p build/tmp)
bun scripts/bench-seed.ts
cp adonisjs/tmp/db.sqlite3 adonisjs/build/tmp/db.sqlite3
RUNS=5 ADONIS_NODE="mise exec node@24 -- node" scripts/bench.sh
```

Requires `oha`, Bun ≥ 1.1, and Node ≥ 24 (AdonisJS 7).

## Reference result (pilot, 2026-07-13, MacBook Air M-series, single round)

| Scenario | Guren rc (Bun 1.3) | AdonisJS 7 (Node 24) | Ratio |
|----------|--------------------|----------------------|-------|
| HTML SSR — req/s | 4,051 | 1,598 | **2.5×** |
| Inertia JSON — req/s | 6,816 | 2,003 | **3.4×** |
| Cold start → first 200 | 285 ms | 492 ms | 1.7× |
| Idle RSS | ~175 MB | ~175 MB | = |

Treat these as illustrative; cite numbers from a fresh Actions run (or your
own) instead.

## Caveats (read before quoting)

1. **Session drivers differ per each framework's setup in this repo**: Guren
   uses an in-memory server-side store, AdonisJS cookie sessions. Anonymous
   load creates a new session per request, so Guren's RSS grows during
   sustained anonymous load (~416 MB after ~160k sessions in the pilot) while
   Adonis's does not. Align drivers (e.g. both cookie/redis) or reuse a
   session cookie in the load generator before publishing memory-under-load
   numbers.
2. HTML payloads differ (Guren shell ~11.9 KB vs Adonis ~8.8 KB), which if
   anything disadvantages Guren in the HTML scenario.
3. Load generator and server share the host. That compresses the gap for the
   faster server (oha steals proportionally more CPU from it), so the ratios
   are, if anything, conservative.
