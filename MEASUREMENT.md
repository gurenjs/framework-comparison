# Measurement Methodology

All numbers in the README are produced by one command:

```bash
bun scripts/measure.ts
```

The script prints a Markdown table you can diff against the README. Numbers are
never edited by hand.

## What is counted

For each implementation directory (`guren/`, `hono/`, `nextjs/`):

| Metric | Definition |
|--------|------------|
| Source files | Committed `*.ts` / `*.tsx` / `*.css` files, minus exclusions below |
| Source LOC | Non-blank lines in those files |
| Config LOC | Non-blank lines in committed config files (`*.config.*`, `tsconfig*.json`, `.env.example`, `drizzle.config.ts`, …) |
| Direct dependencies | `dependencies` + `devDependencies` entries in the implementation's `package.json` |
| Context tokens | Tokens (cl100k_base) required to read every counted source + config file — a proxy for how much an AI agent must load to understand the project |

## What is excluded

- `node_modules/`, lockfiles, and build output (`.next/`, `dist/`, `build/`).
- **Generated artifacts marked as such** — files whose header says "do not edit"
  or that live in a documented codegen output directory (e.g. Guren's `.guren/`,
  Drizzle's `drizzle/meta/`, Next.js' `next-env.d.ts`). Rationale: nobody reads
  or maintains them; they are rebuilt by a command.
- Test files are counted **separately** and reported in their own column, since
  test verbosity is a property of the test API, not the app.

Scaffolded files that the developer subsequently owns and edits (anything
`create-*-app` or a generator produced into the app tree) **are counted**. If a
generator wrote it and you are expected to maintain it, it is your code.

## Fairness rules

- Every implementation follows [SPEC.md](./SPEC.md) exactly.
- Every implementation uses the same database (SQLite), the same ORM (Drizzle),
  and React for the UI, so the deltas isolate framework glue.
- Implementations are written idiomatically per each framework's documentation.
  If you believe an implementation misrepresents your framework, **PRs are
  welcome** — that is the point of publishing the code.
