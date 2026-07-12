# Minilog — Hono

The [SPEC.md](../SPEC.md) blog implemented on plain [Hono](https://hono.dev),
hand-wiring everything a framework would otherwise provide.

## Stack

- **Runtime:** Bun
- **HTTP:** Hono, JSON API under `/api/*`, `csrf()` middleware
- **Database:** SQLite via `bun:sqlite` + Drizzle ORM (SQL migrations in `drizzle/`)
- **Auth:** hand-rolled DB-backed sessions — random token in an HTTP-only
  cookie, rows in a `sessions` table, passwords hashed with `Bun.password`
- **Validation:** Zod + `@hono/zod-validator` with a shared hook returning
  `422 { errors: { field: [messages] } }`
- **Frontend:** React SPA built with Vite, `react-router`, a small fetch
  wrapper, one CSS file
- **Deferred work:** the welcome notification is written fire-and-forget via
  `setTimeout` after the registration response is sent

## Setup

```bash
bun install
```

## Run (development)

```bash
bun run dev
```

Runs both processes via `concurrently`:

- API server on `http://localhost:3000` (`bun --hot src/server/index.ts`)
- Vite dev server on `http://localhost:5173`, proxying `/api` to the API server

Open `http://localhost:5173`. The SQLite database is created and migrated
automatically at `minilog.db` (override with `DATABASE_PATH`).

## Run (production build)

```bash
bun run build   # builds the SPA into dist/
bun run start   # one process: API + static SPA on http://localhost:3000
```

## Test

```bash
bun test
```

Integration tests use Hono's `app.request()` against an in-memory SQLite
database — no server process or network involved.

## Type check

```bash
bun run typecheck
```

## Structure

```
src/server/   Hono app: routes, session auth, validation, Drizzle schema
src/client/   React SPA: pages, auth context, fetch wrapper
drizzle/      generated SQL migrations (bunx drizzle-kit generate)
tests/        bun:test integration tests (SPEC §6)
```
