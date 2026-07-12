# Minilog — AdonisJS implementation

The [SPEC.md](../SPEC.md) application built with idiomatic, current AdonisJS:

| Concern | Choice |
|---------|--------|
| Framework | AdonisJS 7 (`@adonisjs/core` 7.3.x) — requires **Node.js ≥ 24** |
| Frontend | Inertia.js + React 19 with SSR enabled, typed `<Link>` / `<Form>` components from `@adonisjs/inertia/react` |
| Database | SQLite via Lucid ORM (`better-sqlite3`) — SPEC allows the first-party ORM for batteries-included frameworks |
| Auth | `@adonisjs/auth` session guard, scrypt password hashing (`withAuthFinder` mixin) |
| Validation | VineJS validators, per-field errors flashed to the session and surfaced through Inertia's shared `errors` prop; entered values are preserved because Inertia stays on the page on validation failure |
| Authorization | `@adonisjs/bouncer` policies (`PostPolicy`, `CommentPolicy`) |
| Deferred work | Class-based `UserRegistered` event dispatched without `await`; an emitter listener writes the `notifications` row outside the request/response critical path |
| Tests | Japa + `@japa/api-client` functional suite against a separate SQLite test database, migrations run in the runner setup hook, one global transaction per test |

## Scaffold command (baseline)

The project was scaffolded with the official scaffolder, pinned for reproducibility
(`--kit=react` resolves to `github:adonisjs/starter-kits/inertia-react`; the commit
hash pins the kit to the state it had on 2026-05-29, since `create-adonisjs`
downloads the kit's default branch):

```bash
npm init adonisjs@3.4.0 -- adonisjs --kit="github:adonisjs/starter-kits/inertia-react#e6fc43964c2ff4b9ac75859c84a5205d77107749" --pkg=npm
```

### Generator commands used (in order)

```bash
node ace make:model post --migration --transformer
node ace make:model comment --migration --transformer
node ace make:model notification --migration
node ace make:controller posts --resource
node ace make:controller comments store destroy
node ace make:validator post
node ace make:validator comment
node ace make:listener send_welcome_notification --event=user_registered
node ace add @adonisjs/bouncer
node ace make:policy post
node ace make:policy comment
node ace make:preload events --register --environments=web --environments=console --environments=test
node ace make:page posts/index
node ace make:page posts/show
node ace make:page posts/create
node ace make:page posts/edit
node ace make:test auth --suite=functional
node ace make:test posts --suite=functional
node ace make:test comments --suite=functional
npm install --save-dev @japa/api-client
npm uninstall sonner
```

Migration filenames are timestamped at generation time; this repo committed them as
`1783844863180_create_posts_table.ts`, `1783844863601_create_comments_table.ts` and
`1783844864009_create_notifications_table.ts`.

`@japa/api-client` is added because the starter kit only ships the browser-client
testing setup; `sonner` (a toast component library bundled with the starter) is
removed because the SPEC forbids UI component libraries.

## Layout

- `database/migrations/` — `users` (from the starter), `posts`, `comments`, `notifications`
- `database/schema.ts` — **generated** schema classes (`node ace migration:run` re-creates it by scanning the database); models extend these classes
- `app/models/` — Lucid models with `belongsTo` / `hasMany` relationships
- `app/validators/` — VineJS validators (SPEC §4 rules)
- `app/controllers/` — `posts` (resourceful), `comments`, plus the starter's `new_account` / `session`
- `app/policies/` — bouncer policies for post edit/delete and comment delete
- `app/events/` + `app/listeners/` + `start/events.ts` — welcome-notification flow
- `app/transformers/` — typed serialization for Inertia props (`Data.Post`, `Data.Comment`, …)
- `inertia/` — React pages, layout, one plain CSS file
- `tests/functional/` — Japa API-client integration tests (SPEC §6)
- `.adonisjs/` — **generated** barrels and type registries (routes, controllers, events, page props), rebuilt by the dev server / build

## Setup

Requires Node.js ≥ 24.

```bash
npm install
cp .env.example .env
node ace generate:key
node ace migration:run
```

(The scaffold command above performs all of these steps itself; they are only
needed when cloning this repository.)

## Run

```bash
npm run dev                      # dev server with HMR on http://localhost:3333
npm run build && cd build && npm ci --omit="dev" && node bin/server.js   # production
```

## Test / check

```bash
npm test             # Japa functional suite (temp SQLite DB at tmp/test.sqlite3)
npm run typecheck    # tsc --noEmit for server and inertia projects
npm run lint
```

## Notes on the tests

- The runner setup hook runs migrations against a dedicated test database
  (`config/database.ts` switches the SQLite file when `NODE_ENV=test`), and each
  test runs inside a global transaction that is rolled back.
- The deferred welcome notification is asserted by polling the `notifications`
  table, since the listener intentionally runs outside the request path.
- The session plugin's `assertHasValidationError` helper still targets the
  pre-v7 `errors` flash key, while AdonisJS 7 flashes validation errors under
  `inputErrorsBag` only — the tests therefore assert on
  `response.flashMessage('inputErrorsBag')` directly.

## SPEC deviations

- **403 for non-authors**: SPEC allows "403 (or hidden + rejected)". Bouncer's
  authorization exception uses content negotiation: GET requests (e.g. the edit
  page) receive a plain **403**, while mutating requests are **rejected** with a
  redirect back and an "Access denied" flash message. The UI additionally hides
  edit/delete controls from non-authors.
- **Column naming**: the comparison's Drizzle schema uses `author_id`; Lucid's
  convention is `user_id` with the relationship exposed as `author`. The schemas
  are otherwise equivalent (`users.full_name` was tightened to `NOT NULL`,
  max 50 chars, to match the SPEC's required name).
- The starter kit ships signup with a password-confirmation field; it was removed
  because the SPEC registers with name, email and password only.
