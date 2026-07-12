# Minilog — Next.js implementation

The [SPEC.md](../SPEC.md) application built with idiomatic, current Next.js:

| Concern | Choice |
|---------|--------|
| Framework | Next.js 16 (App Router, Server Components, Server Actions, Turbopack) |
| Database | SQLite via Drizzle ORM + better-sqlite3 |
| Auth | Auth.js (next-auth v5) Credentials provider, JWT sessions, bcryptjs hashing |
| Validation | Zod inside Server Actions, surfaced through `useActionState` |
| Deferred work | `after()` from `next/server` writes the welcome notification |
| Tests | Vitest against the Server Actions and data layer on a temp SQLite DB |

## Layout

- `src/db/` — Drizzle schema (`users`, `posts`, `comments`, `notifications`) and client
- `src/auth.ts` / `src/auth.config.ts` — Auth.js setup (config split so the proxy stays DB-free)
- `src/proxy.ts` — optimistic redirect for `/posts/new` and `/posts/:id/edit`
- `src/lib/validation.ts` — Zod schemas + shared form-state type
- `src/lib/data.ts` — data access (post list/show, credential verification)
- `src/lib/actions/` — Server Actions (auth, posts, comments); every mutation re-checks the session and ownership
- `src/app/` — routes; forms are small client components using `useActionState`
- `tests/` — Vitest suite

## Setup

```bash
npm install
cp .env.example .env.local   # then set AUTH_SECRET (npx auth secret, or openssl rand -base64 32)
npm run db:migrate
```

## Run

```bash
npm run dev          # development
npm run build && npm start   # production
```

## Test / check

```bash
npm test             # Vitest integration tests
npm run typecheck    # tsc --noEmit
npm run lint
```

## Testing approach and known gaps

Next.js has no official request-level integration test harness for App Router +
Server Actions, so the tests exercise the Server Actions and data-access
functions directly against a temporary SQLite database, mocking only the
framework seams:

- `@/auth` (`auth` / `signIn` / `signOut`) is mocked to control the session;
  the real credential check (`verifyCredentials`, used by the Credentials
  provider) is tested directly.
- `after()` is queued and flushed by the test, then the notification row is
  asserted.
- `redirect()` / `notFound()` are the real Next.js implementations; tests
  assert the thrown control-flow errors (e.g. rejection of unauthenticated
  post creation is observed as a redirect to `/login`).

Gaps, covered manually in a browser instead:

- **Logout** is a cookie deletion performed by Auth.js; with JWT sessions there
  is no server-side state to assert without a browser. The test verifies the
  action delegates to `signOut`.
- The **login round trip** through the Auth.js HTTP callback (cookie issuance)
  is not exercised; the action's error handling and the credential
  verification it relies on are.

## SPEC deviations

- **403 for non-authors**: SPEC allows "403 or hidden + rejected". This
  implementation hides edit/delete UI from non-authors, returns 404 for the
  edit page, and rejects the mutation in the action — because Next.js'
  `forbidden()` is still experimental (`experimental.authInterrupts`) and
  enabling experimental flags would not be representative.
- Re-rendered invalid forms preserve entered values except passwords, which
  are deliberately never echoed back.
