# Measurement Methodology

All numbers in the README are produced by one command:

```bash
bun scripts/measure.ts
```

`bun scripts/measure.ts --write` rewrites the generated blocks in README.md in
place; without the flag the script only prints them. Numbers in those blocks are
never edited by hand — that is not an aspiration, it is why the flag exists: the
blocks were hand-transcribed once and drifted from the code they described.

## What is counted

For each implementation directory (`guren/`, `hono/`, `nextjs/`, `tanstack/`,
`adonisjs/`, `nestjs/`). The script reads the working tree, not the index, so an
uncommitted or untracked file inside an implementation is measured like any
other:

| Metric | Definition |
|--------|------------|
| Source files | `*.ts` / `*.tsx` / `*.css` / `*.prisma` files, minus exclusions below. `.prisma` is there because author-written data-model definitions count whatever their syntax — Drizzle and Lucid schemas are `.ts` and always counted |
| Source LOC | Non-blank lines in those files |
| Handwritten LOC | Non-blank lines **added relative to the pristine generator output** committed under [`baselines/`](./baselines) (computed with `git diff`). This separates "code you own" from "code you typed": scaffolds produce real code you maintain, but generating it took seconds, not hours. An implementation with no scaffold (`hono/`) has every line handwritten by definition. |
| Config LOC | Non-blank lines in config files (`*.config.*`, `tsconfig*.json`, `.env.example`, `drizzle.config.ts`, …) |
| Direct dependencies | `dependencies` + `devDependencies` entries in the implementation's `package.json` |
| Context tokens | Tokens (cl100k_base) required to read every counted source + config file — a proxy for how much an AI agent must load to understand the project |
| External verification LOC | Non-blank lines under `<impl>/verification/`: spec-compliance tests this repository wrote for a framework that documents no support for the layer SPEC §6 tests. Reported apart from Test LOC because it measures this repository's harness, not the framework's test API — but reported, because the code exists and someone had to write it |
| Agent guidance LOC / tokens | Non-blank lines and cl100k tokens of agent-harness instruction files (`CLAUDE.md`, `AGENTS.md`, `.claude/`, `.cursor/`, `.agents/`, `.github/instructions/`, `.cursorrules`) that are not already counted as code. Kept out of Source LOC and Context tokens, which measure the cost of reading the *app*, and reported on their own rows because a framework that ships a large harness would otherwise carry none of its weight in any column |

## What is excluded

- `node_modules/`, lockfiles, and build output (`.next/`, `dist/`, `build/`).
- **Generated artifacts marked as such** — files whose header says "do not edit"
  or that live in a documented codegen output directory (e.g. Guren's `.guren/`,
  Drizzle's `drizzle/meta/`, Next.js' `next-env.d.ts`, Wasp's `.wasp/`).
  Rationale: nobody reads or maintains them; they are rebuilt by a command.
  Generated SQL migrations fall out because `.sql` is not a counted extension —
  but hand-written migration *classes* (e.g. AdonisJS `database/migrations/*.ts`)
  are code the developer writes and DO count.
- Committed build output, by path rather than by extension (`public/assets/`).
  Bundles are excluded anyway for being `.js`; the hashed stylesheet emitted
  beside them was being counted purely because `.css` is on the extension list,
  which is an accident of the list rather than a rule.
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
matters most where the starter is largest. The generator invocation for each
implementation is documented in that implementation's own README; `baselines/`
holds the pristine output. Recording the invocation in `baselines/<impl>/README.md`
as well is the intent going forward — today several of those files are still the
starter's own README, and `baselines/adonisjs/` has none.

**Results carry a version stamp, and implementations are pinned.** The table is
to record, per implementation, the framework version measured and the date that
implementation was last touched. This is registered here before it is
implemented: the current table carries neither, and the commit that adds the
first compiled-spec implementation is expected to add them. This makes an asymmetry visible that was
previously invisible: implementations are written once against the framework
version current at the time and are not continuously upgraded, so an
implementation that has received maintenance commits is being compared against
ones that have not. Publishing the per-column dates is the honest handling;
re-verifying every implementation against the latest release of its framework on
every measurement is not sustainable for one person. Pull requests upgrading any
implementation to a newer framework version are welcome and are the intended
correction mechanism.

**The tables are regenerated by the script, never by hand.** `bun
scripts/measure.ts --write` rewrites the blocks between the `measure:begin` /
`measure:end` and `areas:begin` / `areas:end` markers in README.md. Manual
write-back is how the published tables came to disagree with the code they
described.

**Context tokens exclude generated output, for every implementation.** For a
framework that compiles a spec, the counted files are therefore the spec and the
operations, not the generated tree. Whatever the resulting number is, it is
published unadjusted, footnoted with the fact that an agent *debugging* through
generated code would read more than the count suggests.
