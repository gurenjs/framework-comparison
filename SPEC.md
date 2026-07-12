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
- Performance benchmarking (this repository measures code, not throughput).
