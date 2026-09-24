# Minilog Guren

## Overview

A fullstack TypeScript application built with the Guren framework (Laravel-inspired, running on Bun).

## AI Agents: Start Here

Before exploring `node_modules`, use the built-in introspection commands:

```bash
bunx guren context         # project map: models, routes, controllers, pages (add --json for JSON)
bunx guren context User    # everything about one entity: model, routes, pages, linked docs — start entity work here
bunx guren check           # validate route ↔ controller ↔ page consistency, doc links, and spec freshness — run after changes
bunx guren docs:graph --path <file>  # which docs govern this file, which spec views derive from it — ask BEFORE renaming/moving
bunx guren codegen         # regenerate .guren/*.gen.ts typed manifests (also runs via `bun run dev`)
bunx guren spec:generate   # regenerate docs/spec/ views (ER, domain, screens, modules) after schema/model/route changes
bunx guren make:adr "..."  # record an architecture decision under docs/adr/ (--entity <Model> links it)
```

This project ships with an agent harness wired into `.claude/settings.json`:
a `SessionStart` hook injects the `guren context` project map, and a
`PostToolUse` hook (`.claude/hooks/check-after-edit.ts`) re-runs `guren check`
after edits to routes, controllers, models, schema, or pages, and runs oxlint on
the edited file when the app has an `.oxlintrc.json` (`bunx guren add lint`
writes one; warnings are reported too), feeding findings back immediately. A
`Stop` hook (`.claude/hooks/gate-on-stop.ts`) runs `guren gate` when you finish a
turn with uncommitted changes: codegen, typecheck, lint, `check`, `audit`, and
the test suite, the same stages CI runs. If any stage fails, the stop is blocked
once and the findings come back to you — fix them in the same turn rather than
leaving them for CI. Run `bunx guren gate` yourself before declaring a change
done. The same hook verifies the plan step `bunx guren plan:next` marked
(`plan-implement` skill): while the step is not verified it sends you back, up
to three times, then records the step as stalled and says why. The injected map
ends with a "Guren API Signatures"
digest of the ORM, controller, and testing APIs — those signatures are already
in your context before you write any code. Framework-managed files
(`.claude/rules`, `skills`, `agents`, `hooks`) can be refreshed anytime with
`bunx guren agent:sync`.

Detailed, verified API rules live in `.claude/rules/*.md` and load automatically
based on the files you are editing (glob-scoped).

The rule files: `orm-models.md` (models, queries, relations),
`controllers-http.md` (validation, Inertia, auth), `routes-codegen.md`
(route options, schema binding, codegen), `testing.md` (TestApp assertions),
`docs-and-spec.md` (linked ADRs/docs, generated spec views), `comments.md`
(what a comment may carry, the size limits, the oxlint rules behind them).
For framework signatures, check the `guren context` digest first, then the
matching rule file; only read `node_modules/@guren/*` for APIs neither covers.

## Project Structure

```
app/
├── Http/
│   ├── Controllers/    # Request handlers
│   ├── Middleware/      # HTTP middleware
│   └── Resources/       # API resource transformers
├── Models/              # Drizzle ORM models
├── Events/              # Event classes
├── Listeners/           # Event listeners
├── Jobs/                # Queue job classes
├── Mail/                # Mailable classes
├── Notifications/       # Notification classes
├── Providers/           # Service providers
├── Exceptions/          # Custom exceptions
└── Console/Commands/    # CLI commands
bin/
└── serve.ts             # Server entry point
config/                  # Application configuration
db/
├── schema.ts            # Drizzle table definitions
├── migrations/          # SQL migration files
├── factories/           # Model factories
└── seeders/             # Database seeders
resources/js/
├── pages/               # Inertia.js React pages
├── components/          # Shared React components
└── layouts/             # Page layouts
routes/
├── web.ts               # Web routes
└── api.ts               # API routes (if applicable)
tests/
├── controllers/         # Controller tests
└── models/              # Model tests
```

## Development Commands

```bash
# Start development server
bun run dev

# Generate components
bunx guren make:controller <Name>
bunx guren make:model <Name>
bunx guren make:migration <name>
bunx guren make:view <path>
bunx guren make:middleware <Name>
bunx guren make:job <Name>
bunx guren make:event <Name>
bunx guren make:listener <Name> --event=<EventName>
bunx guren make:mail <Name>
bunx guren make:test <Name>

# Growing past a flat app/? Scaffold a self-contained module:
bunx guren make:module <Name>                    # modules/<name>/{index.ts,routes.ts,db/schema.ts}, wired into src/app.ts
bunx guren make:controller <Name> --module <name> # most make:* commands accept --module

# Database workflow: edit db/schema.ts first, then
bunx guren make:migration <name>   # generate SQL migration via drizzle-kit into db/migrations/
bun run db:migrate                 # apply pending migrations
bunx guren db:status               # show applied/pending state
bun run db:seed                    # run seeders
# Migrations are forward-only (no rollback). Dev reset: bunx guren db:reset --seed

# Build & test
bun run build
bun run test
bunx guren gate                    # every CI stage (codegen, typecheck, lint, check, audit, test); exit 0 = done

# Implementation plans (a *.plan.json approved for this app; the plan-implement skill runs the loop)
bunx guren plan:next <plan>                  # the next step to implement, with its elements, behaviours and verify commands
bunx guren plan:verify <plan> --step <id>    # run the step's verify commands and tests, record the verdict under .guren/plans/
bunx guren plan:status <plan>                # which plan elements exist in the code, and which are verified
```

## MCP Server (AI Agent Integration)

`bun run dev` starts an MCP endpoint alongside the dev server (enabled by
`GUREN_MCP=1` in the `dev` script; if your script lacks it, run
`GUREN_MCP=1 bun run dev`; the flag has no effect in production):

```
http://localhost:3333/_guren/mcp
```

`bunx guren agent:init` writes the MCP client config for the agents you
selected: `.mcp.json` (Claude Code), `.cursor/mcp.json` (Cursor),
`.vscode/mcp.json` (VS Code / Copilot), `.codex/config.toml` (Codex — a
project-scoped config Codex reads in trusted projects only), or the `mcp`
entry in `opencode.json` (OpenCode). If your agent is not configured yet,
point it at the URL above as a streamable-HTTP server.

The endpoint only accepts requests from this machine: browser pages on other
origins (including DNS rebinding) and requests from other hosts on the LAN
are rejected with 403.

### Available tools

| Tool | Description |
|------|-------------|
| `guren_get_context` | Project structure map (models, routes, pages, controllers, …) |
| `guren_entity_context` | Entity-centric context bundle (model, routes, pages, linked docs) |
| `guren_check` | Validate route ↔ controller ↔ page consistency, doc links, spec freshness |
| `guren_gate` | Every CI stage (codegen, typecheck, lint, check, audit, test) in one verdict; `ok` = the change is done |
| `guren_docs_graph` | OKF docs relation graph (narrow with entity/path) — impact query before renames |
| `guren_list_models` | List models (relations, soft deletes, auth trait) |
| `guren_generate_guidelines` | Generate project-specific coding guidelines |
| `guren_doctor` | Project health check + suggested next actions |
| `guren_make_feature` | Scaffold a complete CRUD feature |
| `guren_make_component` | Scaffold a single component |
| `guren_codegen` | Generate typed manifests (routes.gen.ts, pages.gen.ts, …) |

## Architecture Overview

The request lifecycle: `routes/web.ts` registers routes on a `Router`, each pointing
at a `[Controller, 'method']` tuple. Controllers validate input with Zod schemas,
query models, and render Inertia pages or JSON.

```typescript
// routes/web.ts
router.get('/posts', [PostController, 'index']).name('posts.index')
router.post('/posts', { name: 'posts.store', body: CreatePostSchema }, [PostController, 'store'])

// app/Http/Controllers/PostController.ts
export class PostController extends Controller {
  async store() {
    const { body: data } = this.validated('posts.store')     // the route's body schema answered 422 already
    const user = await this.auth.userOrFail<UserRecord>()    // 401 if unauthenticated
    const post = await Post.create({ ...data, authorId: user.id })
    return this.redirect('/posts')
  }
}

// app/Models/Post.ts
export class Post extends defineModel(posts, {
  fillable: ['title', 'body', 'authorId'],  // typed against the table's columns
}) {}
```

- Models: `await Post.findOrFail(id)` throws a 404; `Post.where(...)` starts a query
  builder chain. Full API in `.claude/rules/orm-models.md`.
- Attaching a Zod schema to a route both validates the request automatically and
  feeds `bunx guren codegen` typed manifests. Details in `.claude/rules/routes-codegen.md`.
- Middleware: `defineMiddleware(async (c, next) => { ... })` from `@guren/core`;
  register aliases via `const router = baseRouter.aliasMiddleware('auth', requireAuthenticated({ redirectTo: '/login' }))`
  — the return value carries the alias name in the router's type, so dropping it makes
  a later `.middleware('auth')` fail to compile.

## Testing

Uses `bun:test` + `@guren/testing`. Requests run in-process via `app.fetch()` — no server needed.

```typescript
import { TestApp } from '@guren/testing'

const app = await TestApp.create()
await app.get('/posts').assertOk()
await app.actingAs(user).json().post('/posts', { title: 'Hi' }).assertCreated()
```

Full client and assertion reference: `.claude/rules/testing.md`.

## Key Files

| Path | Purpose |
|------|---------|
| `bin/serve.ts` | Server entry point |
| `config/` | Application configuration |
| `db/schema.ts` | Database table definitions |
| `routes/web.ts` | Web route definitions |
| `app/Providers/` | Service providers |
| `resources/js/pages/` | React page components |
| `.claude/rules/` | Verified API rules (each file's `globs` frontmatter states the covered paths) |
