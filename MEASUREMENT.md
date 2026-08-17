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
| Handwritten LOC | Non-blank lines **added relative to the pristine generator output** committed under [`baselines/`](./baselines) (computed with `git diff`). This separates "code you own" from "code you typed": scaffolds produce real code you maintain, but generating it took seconds, not hours. An implementation with no scaffold (`hono/`) has every line handwritten by definition. |
| Config LOC | Non-blank lines in committed config files (`*.config.*`, `tsconfig*.json`, `.env.example`, `drizzle.config.ts`, …) |
| Direct dependencies | `dependencies` + `devDependencies` entries in the implementation's `package.json` |
| Context tokens | Tokens (cl100k_base) required to read every counted source + config file — a proxy for how much an AI agent must load to understand the project |

## What is excluded

- `node_modules/`, lockfiles, and build output (`.next/`, `dist/`, `build/`).
- **Generated artifacts marked as such** — files whose header says "do not edit"
  or that live in a documented codegen output directory (e.g. Guren's `.guren/`,
  Drizzle's `drizzle/meta/`, Next.js' `next-env.d.ts`). Rationale: nobody reads
  or maintains them; they are rebuilt by a command. Generated SQL migrations
  fall out automatically (only `.ts`/`.tsx`/`.css` are counted) — but
  hand-written migration *classes* (e.g. AdonisJS `database/migrations/*.ts`)
  are code the developer writes and DO count.
- Test files are counted **separately** and reported in their own column, since
  test verbosity is a property of the test API, not the app.

One known bias: generators that timestamp filenames (e.g. AdonisJS
migrations) produce different names in the committed baseline, so those files
diff as fully handwritten even though a skeleton was generated. This slightly
*overstates* handwritten LOC for such frameworks; we accept the error because
it is small and conservative.

Scaffolded files that the developer subsequently owns and edits (anything
`create-*-app` or a generator produced into the app tree) **are counted** in
Source LOC — if a generator wrote it and you are expected to maintain it, it is
your code. The Handwritten LOC metric then shows how much of it you actually
typed: `baselines/<impl>/` holds the untouched output of the exact generator
commands documented in each implementation's README, and the metric is the
added-line diff against it.

## Fairness rules

- Every implementation follows [SPEC.md](./SPEC.md) exactly.
- Every implementation uses the same database (SQLite), the same ORM (Drizzle —
  except frameworks that ship a first-party ORM, per SPEC), and React for the
  UI, so the deltas isolate framework glue.
- Implementations are written idiomatically per each framework's documentation.
  If you believe an implementation misrepresents your framework, **PRs are
  welcome** — that is the point of publishing the code.

## Rule clarifications registered before new implementations

Same discipline as [SPEC.md](./SPEC.md): fixed before the implementation they
concern exists, in a commit that predates it.

### 2026-08-17 — registered before `wasp/`

**Data-model definitions count regardless of file extension.** `.prisma` joins
the counted extensions. The principle was always "code the developer authors
that defines the app": Drizzle schemas (`.ts`) and Lucid models (`.ts`) already
counted, and a Prisma schema is the same artifact in a different syntax.
Prisma's generated `.sql` migrations stay excluded, consistent with Drizzle's.
This change leaves the existing six columns byte-identical — the commit that
introduces it shows the unchanged table.

**App-definition files are Source; toolchain configuration is Config.** No
framework-specific rule is added for Wasp's `main.wasp.ts`. It ends in `.ts` and
matches neither `*.config.*` nor `tsconfig*.json`, so the existing `classify()`
already counts it as Source, and that is the correct side of the line: it
declares routes, pages, auth and jobs, which is what `routes/web.ts` declares in
`guren/`. Its own line count is published in the results footnotes so a reader
who disagrees can move it to the Config column themselves.

**Generated output directories.** `.wasp/` is excluded, on the same rule that
excludes `.guren/`, `.next/` and `.output/`.

**Direct dependencies are not comparable when the framework is not a
dependency.** Wasp is installed as a global CLI binary and its runtime
dependencies live in the generated `.wasp/out` workspace, so the app's
`package.json` lists React, Prisma and the toolchain but not Wasp itself. That
cell is reported with a footnote stating what it does and does not include,
rather than as a number that looks like the others.

**Handwritten LOC counts added lines only; deletions are free.** This has always
been true of the metric and is now stated: an implementation that starts from a
large starter and deletes most of it pays nothing for the deletion. The bias
matters most where the starter is largest. Each `baselines/<impl>/README.md`
records the exact generator invocation, template flags included, so the baseline
is reproducible.

**Results carry a version stamp, and implementations are pinned.** The table
records, per implementation, the framework version measured and the date that
implementation was last touched. This makes an asymmetry visible that was
previously invisible: implementations are written once against the framework
version current at the time and are not continuously upgraded, so an
implementation that has received maintenance commits is being compared against
ones that have not. Publishing the per-column dates is the honest handling;
re-verifying every implementation against the latest release of its framework on
every measurement is not sustainable for one person. Pull requests upgrading any
implementation to a newer framework version are welcome and are the intended
correction mechanism.

**The table is regenerated by the script, never by hand.** `bun scripts/measure.ts
--write` rewrites the block between the `measure:begin` / `measure:end` markers in
README.md. Manual write-back is how the published table came to disagree with the
code it described.

**Context tokens exclude generated output, for every implementation.** For a
framework that compiles a spec, the counted files are therefore the spec and the
operations, not the generated tree. Whatever the resulting number is, it is
published unadjusted, footnoted with the fact that an agent *debugging* through
generated code would read more than the count suggests.
