# Minilog — TanStack Start implementation

The [SPEC.md](../SPEC.md) application built with idiomatic, current TanStack Start:

| Concern | Choice |
|---------|--------|
| Framework | TanStack Start 1.x (`@tanstack/react-start`, file-based routing, SSR, Vite plugin) |
| Runtime | Node.js (the scaffold's default; `npm run dev` / `vite build`) |
| Database | SQLite via Drizzle ORM + better-sqlite3 (migrations run on boot) |
| Auth | TanStack Start's `useSession` — encrypted, HTTP-only cookie sessions; passwords hashed with `node:crypto` scrypt |
| Data & mutations | `createServerFn` called from route loaders and form handlers (`useServerFn`) |
| Validation | Zod inside server functions, returning per-field errors as data |
| Deferred work | fire-and-forget `setTimeout` helper writes the welcome notification after the response |
| Tests | Vitest against the data-access layer and auth guard on a temp SQLite DB |

## Scaffold command (baseline)

The project was scaffolded with the official TanStack CLI, pinned:

```bash
npx @tanstack/cli@0.69.5 create tanstack --framework react --package-manager npm --no-toolchain --no-examples --no-git --no-intent -y
```

Post-scaffold changes to note: the CLI unconditionally sets up Tailwind CSS
(`--no-tailwind` is a deprecated no-op), which [SPEC.md](../SPEC.md) forbids —
it was removed per the scaffold README's own "Removing Tailwind CSS"
instructions and replaced with one plain CSS file. Scaffold dependencies this
implementation does not use were uninstalled (`lucide-react`,
`@tanstack/react-router-ssr-query`, `@testing-library/*`, `jsdom`);
`drizzle-orm`, `better-sqlite3`, `zod`, `drizzle-kit` were added.

## Layout

- `src/db/` — Drizzle schema (`users`, `posts`, `comments`, `notifications`) and client (migrates on import)
- `src/server/session.ts` — `useAppSession` cookie session + `requireUserId` guard
- `src/server/password.ts` — scrypt hash/verify (no external dependency)
- `src/server/validation.ts` — Zod schemas + per-field error helper
- `src/server/{auth,posts,comments}.ts` — plain data-access/business logic (what the tests exercise)
- `src/server/*.functions.ts` — `createServerFn` wrappers: session, validation results, redirects
- `src/server/notifications.ts` — deferred welcome-notification writer
- `src/routes/` — file-based routes; forms are small client components calling server functions via `useServerFn`
- `tests/` — Vitest suite (temp SQLite DB per run; session primitive stubbed in-memory)

## Setup

```bash
npm install
cp .env.example .env   # optional in dev; set SESSION_SECRET (32+ chars) for production
```

The SQLite database (`minilog.db`, override with `DATABASE_PATH`) is created
and migrated automatically on first boot. Migrations are regenerated with
`npm run db:generate` after schema changes.

## Run

```bash
npm run dev                        # development on http://localhost:3000
npm run build && npm run preview   # production build served by vite preview
```

`SESSION_SECRET` is required when `NODE_ENV=production`; development falls back
to a built-in insecure secret.

## Test / check

```bash
npm test             # Vitest
npm run typecheck    # tsc --noEmit
```

## Testing approach and known gaps

Compiled server functions only execute inside TanStack Start's request runtime
(calling one under plain Vitest throws "No Start context found"), and Start has
no official request-level test harness yet. Following the structure the Start
docs recommend — server functions in `*.functions.ts` as thin wrappers over
plain server modules — the tests exercise those plain functions directly
against a temporary SQLite database:

- **register → login → logout**: `registerUser` / `verifyCredentials` are
  tested directly; login/logout session semantics are tested through
  `useAppSession`/`requireUserId` with the framework's cookie-session
  primitive (`useSession`) stubbed in-memory.
- **Unauthenticated post creation rejected**: `requireUserId` — the guard every
  mutating server function calls first — is asserted to throw a redirect to
  `/login` when the session is empty.
- **Post create/edit/delete, ownership, comments, validation**: covered
  directly on the logic layer.
- **Welcome notification**: asserted absent immediately after registration
  returns, present after the deferred write flushes.

Gap: the `createServerFn` wrapper wiring itself (RPC serialization, cookie
round-trip, redirects over HTTP) is not covered by Vitest; it was verified
manually against the production build (register → session cookie → create
post → SSR list → 404 for unknown ids).

## SPEC deviations

- **403 for non-authors**: SPEC allows "403 or hidden + rejected". Edit/delete
  UI is hidden from non-authors, the edit page returns 404, and every mutation
  re-checks ownership server-side and rejects — TanStack Start has no built-in
  way to send a 403 status from a thrown server-function error, and inventing
  a custom response envelope for it would be unidiomatic.
- **Tailwind removal**: the pinned scaffold cannot opt out of Tailwind, so the
  committed code diverges from the baseline by removing it (see above).
