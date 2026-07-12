# Minilog — NestJS

The [SPEC.md](../SPEC.md) blog implemented with idiomatic [NestJS](https://nestjs.com):
modules, controllers, providers, DTOs, guards, and pipes, paired with a minimal
Vite React SPA in the same directory (like the Hono implementation).

Generator commands used (their pristine output is committed as
[`baselines/nestjs`](../baselines/nestjs) for the handwritten-LOC metric):

```bash
npx @nestjs/cli@11.0.24 new nestjs --strict --skip-git --package-manager npm
cd nestjs
npx nest g module database
npx nest g module users
npx nest g service users --no-spec
npx nest g module auth
npx nest g controller auth --no-spec
npx nest g service auth --no-spec
npx nest g guard auth/authenticated --flat --no-spec
npx nest g guard auth/local-auth --flat --no-spec
npx nest g resource posts --type rest --crud --no-spec
npx nest g guard posts/post-author --flat --no-spec
npx nest g module comments
npx nest g controller comments --no-spec
npx nest g service comments --no-spec
npx nest g guard comments/comment-access --flat --no-spec
npx nest g module notifications
npx nest g service notifications --no-spec
```

## Stack

- **Runtime:** Node.js
- **Framework:** NestJS 11 (Express platform), JSON API under `/api/*`
- **Database:** SQLite via better-sqlite3 + Drizzle ORM, exposed through a
  global `DatabaseModule` provider (`DRIZZLE` injection token); SQL migrations
  in `drizzle/` (`npm run db:generate`) run automatically at startup
- **Auth:** `@nestjs/passport` + `passport-local` with `express-session`
  cookie sessions (HTTP-only, SameSite=Lax) — the documented Nest recipe:
  `LocalStrategy`, `LocalAuthGuard` (calls `logIn`), `SessionSerializer`
  (stores the user id, re-fetches the user per request), `AuthenticatedGuard`;
  passwords hashed with bcryptjs
- **Validation:** class-validator DTOs through a global `ValidationPipe`
  (`whitelist: true`, `transform: true`) with a custom `exceptionFactory`
  returning `422 { errors: { field: [messages] } }`
- **Authorization:** guards — `PostAuthorGuard` (403 for non-author
  edit/delete) and `CommentAccessGuard` (comment author or post author may
  delete)
- **Deferred work:** the welcome notification row is written by
  `NotificationsService` via `@nestjs/event-emitter` —
  `@OnEvent('user.registered', { async: true })` runs the listener outside
  the request/response critical path
- **Frontend:** React SPA in `client/` built with Vite, `react-router`, a
  small fetch wrapper, one CSS file; served by `@nestjs/serve-static` in
  production, by the Vite dev server (proxying `/api`) in development

## Setup

```bash
npm install
```

## Run (development)

```bash
npm run dev
```

Runs both processes via `concurrently`:

- API server on `http://localhost:3000` (`nest start --watch`)
- Vite dev server on `http://localhost:5173`, proxying `/api` to the API server

Open `http://localhost:5173`. The SQLite database is created and migrated
automatically at `minilog.db` (override with `DATABASE_PATH`; set
`SESSION_SECRET` outside local development).

## Run (production build)

```bash
npm run build       # nest build + vite build (SPA into client/dist/)
npm run start:prod  # one process: API + static SPA on http://localhost:3000
```

## Test

```bash
npm test
```

The SPEC §6 scenarios run as e2e tests (Jest + supertest, Nest's standard
`Test.createTestingModule` setup) against the real module tree and the same
`setupApp()` pipeline as `main.ts`, on an in-memory SQLite database. Passport
registers strategies and session (de)serializers on a process-global instance,
so each spec file boots exactly one app (Jest runs spec files in separate
workers).

## Type check

```bash
npm run typecheck   # server + tests, then the client
```

## Structure

```
src/            Nest app: auth, posts, comments, users, notifications, database modules
src/setup-app.ts  global prefix, ValidationPipe, session + Passport middleware
client/         React SPA: pages, auth context, fetch wrapper
drizzle/        generated SQL migrations (npm run db:generate)
test/           Jest + supertest e2e tests (SPEC §6)
```

## SPEC deviations

- **Login validation:** guards run before pipes in Nest, so `LocalAuthGuard`
  short-circuits the login DTO validation a `ValidationPipe` would do. Invalid
  login input (malformed email, empty password) surfaces as
  `401 Invalid email or password` rather than 422 per-field errors, which the
  SPA shows as a form-level error. All other mutating endpoints return 422
  per-field errors per SPEC §4.
- **Sessions** are stored in `express-session`'s default in-memory store (the
  approach in Nest's own passport-session documentation), not in the database
  — SPEC only requires cookie-based sessions that persist across requests.
