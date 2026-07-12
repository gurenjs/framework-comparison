# Where Guren agents lost their turns — stumble analysis (2026-07-13)

Source: the three round-2 guren trial streams (`guren-{2,3,4}.stream.jsonl`),
cross-checked against hono/nextjs streams. Method: chronological digest of
every tool call, error results annotated.

## Headline

**The 2× cost gap is knowledge acquisition, not implementation difficulty.**
Guren agents spent 17–46% of all tool actions reverse-engineering framework
internals out of `node_modules/@guren/*/dist/` (compiled bundles and .d.ts):

| trial | actions total | @guren/zod internals archaeology | share |
|-------|--------------|----------------------------------|-------|
| guren-2 | 101 | 18 | 17% |
| guren-3 | 103 | 48 | 46% |
| guren-4 | 139 | 60 | 43% |

hono/nextjs agents touched `node_modules` near-zero times — the model already
knows those APIs from training data. Once Guren agents started editing, they
were fast and nearly error-free: guren-4 went from first edit (msg 124) to a
fully green suite (msg 177) with **zero test-failure loops**. The implementation
phase is fine; the ramp is the problem.

## What they were hunting for (deduplicated across runs)

1. **ORM relations** — `belongsToMany` / `attach` / `detach` / `sync`
   signatures (found in dist .d.ts after ~10 msgs each run; JSDoc examples in
   the .d.ts were what finally unblocked them).
2. **Codegen's zod support matrix** — guren-4 burned ~45 messages grepping
   `@guren/cli` dist chunks and running standalone zod probes to learn whether
   `.trim().optional().default().transform()` chains survive `bun run codegen`
   type extraction (Route Schema Binding makes validator shape feed generated
   types, so the worry is rational).
3. **Controller validation semantics** — `validateBody/Query/Params` return
   types, `ValidationException`/422 behavior, `formatValidationErrors`.
4. **Testing API surface** — `TestApp` assertion list (`assertJsonPath`,
   `assertInertia`, …), read out of `@guren/testing/dist/index.js`.
5. **Mass assignment** — `fillable` / `MassAssignmentException` semantics.
6. **Query operators** — whether `where` supports `in` (they ended up reading
   drizzle-orm sources).
7. **CLI behavior** — `make:migration` / `db:make` semantics from `bin.js`.
8. **Missing helper** — `firstOrCreate`/`updateOrCreate` does not exist in
   @guren/orm; every run hand-rolled tag find-or-create + reconciliation.

Notably, **no run ever discovered `guren check`, `guren context`, or
`guren guidelines`** — the affordances built for exactly this situation.
`bun run codegen` was found only via package.json scripts.

## Coverage check: would the scaffold CLAUDE.md have helped?

Grepping the create-guren-app default template's CLAUDE.md for the hunted
topics: `belongsToMany` 0 hits, `fillable` 0, `assertJsonPath` 0,
`guren check` 0, `inArray`/where-operators 0, codegen 1 (mention only).
**Even with agent guidance restored (round 3), most of the archaeology above
would recur.**

## Backlog for gurenjs (ordered by expected turn savings)

1. **Ship a compact API reference inside the npm packages themselves**
   (e.g. `API.md` / `llms.txt` next to dist) covering: Model statics + relations
   (with belongsToMany/attach/sync examples), Controller validate* signatures,
   where-operator table, fillable/mass-assignment, TestApp assertion list.
   Works even when scaffold-level guidance is stripped — agents already grep
   `node_modules/@guren` as their first move.
2. **Expand the scaffold CLAUDE.md** with the eight hunted topics above, and
   an explicit "AI agents: run `guren context` / `guren check` first" section;
   mirror it as `AGENTS.md` (the convention next/adonis scaffolds follow).
3. **Document codegen's zod support matrix** (which constructs are extracted
   into ApiRoutes types and which degrade to `unknown`) — single biggest
   sink in guren-4.
4. **Add `firstOrCreate`/`updateOrCreate` to @guren/orm** — every trial
   hand-rolled it for tags; it's also the natural companion to belongsToMany
   sync flows.
5. Keep investing in .d.ts JSDoc examples — they are what agents actually
   quote once found.

## Verdict interpretation for the comparison content

The round-2 numbers measure "framework whose API the model doesn't know,
without its guidance layer". That's a real condition (it is what a fresh
agent sees today) but it's also the most fixable one: items 1–3 are pure
documentation-placement work, and round 3 will measure how much of the gap
they close.
