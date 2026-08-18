# Specification: "Minilog"

Every implementation in this repository builds the **same application** — a minimal
multi-user blog — from this specification. If an implementation deviates from this
document, that is a bug; please open an issue or PR.

## Features

### 1. Authentication

- Register with name, email, and password. Email must be unique.
- Log in with email and password; log out.
- Sessions persist across requests (cookie-based, HTTP-only).
- Passwords are stored hashed (framework-idiomatic algorithm).

### 2. Posts

- **List** (`/` or `/posts`): all posts, newest first, paginated 10 per page.
- **Show** (`/posts/:id`): title, body, author name, comments. Unknown id → 404.
- **Create**: logged-in users only.
- **Edit / Delete**: the post's author only. Other users → 403 (or hidden + rejected).

### 3. Comments

- Logged-in users can comment on a post from its show page.
- A comment can be deleted by its author or by the post's author.

### 4. Validation

Server-side validation on every mutating request:

| Field | Rule |
|-------|------|
| name | 1–50 chars |
| email | valid email format |
| password | at least 8 chars |
| post title | 1–120 chars |
| post body | 1–10,000 chars |
| comment body | 1–1,000 chars |

Invalid form submissions re-render with error messages next to the offending
fields and previously entered values preserved.

### 5. Welcome notification

On successful registration, record a welcome notification for the new user
**outside the request/response critical path**, using the framework's idiomatic
mechanism for deferred work (queue, job, `after`/`waitUntil`, etc.). Writing a
row to a `notifications` table or a structured log entry both count.

### 6. Tests

Integration tests covering at minimum:

- register → login → logout flow
- unauthenticated post creation is rejected
- post create/edit/delete happy path
- a non-author cannot edit or delete someone else's post
- validation errors are returned for invalid input

Use the framework's idiomatic testing tooling.

## Constraints (all implementations)

- **TypeScript** with `strict: true`.
- **SQLite** as the database.
- **Drizzle ORM** for database access, with equivalent schemas
  (`users`, `posts`, `comments`, `notifications`). This isolates the comparison
  to framework glue, not ORM differences. Exception: a framework that ships a
  **first-party ORM** (e.g. AdonisJS's Lucid) uses that instead — replacing a
  batteries-included framework's own ORM would be unidiomatic. Schemas must
  stay equivalent.
- **React** for the UI. Backend-only frameworks (e.g. NestJS) pair with a
  minimal Vite React SPA in the same directory, like the Hono implementation.
- Minimal, unstyled UI (a single small CSS file is allowed). No UI component
  libraries and no CSS frameworks (plain CSS only — this keeps styling out of
  the measurements entirely). UI polish is explicitly out of scope.
- Idiomatic code, written the way the framework's own documentation recommends.
  No code golf, no artificial verbosity.
- Each implementation is self-contained in its directory with its own
  `package.json` and a README documenting setup and run instructions.

## Non-goals

- Visual design, accessibility auditing, i18n.
- Production deployment configuration.
- Performance benchmarking as part of the LOC / agent comparison (those
  measure code, not throughput). The separate Bun-vs-Node HTTP benchmark of the
  two Inertia apps lives in [BENCHMARK.md](./BENCHMARK.md).

## Rule clarifications registered before new implementations

These rules are fixed *before* the implementation they concern is written, so
that the ruleset cannot be tuned to the result. Each entry records the date and
the implementation that prompted it.

Naming a framework here is a record of which implementation forced a rule to be
written down, not a claim about that framework. Every implementation in this
repository is meant to be a fair representation of its framework, and the
[Fairness](./README.md#fairness) note applies to all of them equally.

### 2026-08-17 — registered before `wasp/`

**Compiled-spec frameworks.** A framework whose app definition is compiled into
generated output (Wasp: `main.wasp.ts` → `.wasp/out`) is implemented the way its
own documentation prescribes. Editing generated output is out of scope, exactly
as editing `.guren/` output would be.

**ORM.** The first-party-ORM exception extends to a framework that is
structurally bound to one ORM. Wasp generates its data layer from Prisma and
cannot use Drizzle without leaving the framework, so `wasp/` uses Prisma.
Schemas stay equivalent to the Drizzle schemas (`users`, `posts`, `comments`,
`notifications`).

**Database.** SQLite, as for every other implementation. Wasp documents SQLite
as development-only and expects PostgreSQL in production. This repository
measures code, not deployments, so SQLite is used and the constraint is
footnoted rather than worked around.

**Starter selection.** Where a framework offers several starters, the
implementation uses the smallest one that satisfies the constraints above. For
Wasp that is `wasp new --template minimal`: the `basic` starter ships Tailwind
CSS, which the plain-CSS constraint forbids.

**§4 validation errors is a behavioural requirement.** "Re-render with error
messages next to the offending fields and previously entered values preserved"
describes what the user sees, not how it is produced. A server-rendered
re-render (Inertia) and a client component holding form state while an action
returns a field-keyed error both satisfy it.

**§2 unknown id → 404 is a behavioural requirement.** A server-side 404 response
and a query that throws the framework's HTTP-404 error while the client renders
a not-found state both satisfy it.

**§6 tests, where the framework documents none.** If a framework's own
documentation states that it provides no way to test the layer the spec requires
tests for, its Test columns are reported as N/A with that citation, and are
*not* filled in with a harness written for this repository. Spec compliance is
still demonstrated, and its cost is still published: those tests live in
`<impl>/verification/` and are reported on their own **External verification
LOC** row. Filling the Test column itself with a hand-rolled harness would report
a property of this repository's test code, not of the framework, which is what
every other cell in that column measures — but erasing the harness entirely would
hide real work behind an N/A, so it gets a row of its own instead.

This is the case for Wasp 0.25.0, which documents server-side testing as work
that is planned rather than absent, with an open tracking issue: "Wasp currently
does not provide a way to test your server-side code, but we will be adding
support soon." (`web/docs/project/testing.md` at tag `v0.25.0`). Its client-side
Vitest support is real and unaffected by this rule; it simply is not the layer
§6 asks for. The rule exists so that a status a framework already documents is
reported as that status, on a date, rather than replaced by a number this
repository made up.
