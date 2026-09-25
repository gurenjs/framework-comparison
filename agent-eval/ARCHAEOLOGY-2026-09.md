# Where the September re-run spent its tokens (2026-09-25)

Source: the 12 Part A cells of the September re-run
(`results/{guren-shipped,guren-bare,hono-sep,guren-july}-{1,2,3}.stream.jsonl`,
`claude-sonnet-5`, isolated runner, N=3 per arm), plus a fifth arm run
afterwards: `guren-shipped-paths-{1,2,3}`. That arm is the same app and the
same shipped harness, except that the six rule files scope themselves with
`paths:` instead of `globs:` (branch exp/rules-paths, 1e756eb). Script:
[`classify-archaeology.ts`](./classify-archaeology.ts)
(`bun agent-eval/classify-archaeology.ts`). The question comes from §6 of the
round-2 plan: is the remaining Guren-vs-hono cost gap name confusion between
`@guren/core` and `@guren/server` (which RFC 0024 would remove), API learning
(which it would not), or implementation?

## Method

Every tool action is classified from its input and its result, following the
method in STUMBLES.md:

- **(a) name confusion**: searches for which package holds a symbol across
  the core/server split. It is a lower bound: a core search that comes back
  empty opens a chain, and the chain counts as (a) only if it ends in a hit
  under `@guren/server`. A chain that ends in `@guren/orm` counts as (b),
  because RFC 0024 keeps the ORM a separate package. So does anything
  ambiguous.
- **(b) API learning**: reading `node_modules/@guren/*` (or, for hono,
  `node_modules/hono` and drizzle; no hono cell did), guidance files,
  generated `.guren/` types, or `guren context` / `--help`. The guidance an
  arm loads at session start is reported separately as **b-pushed**: the
  part of the call-1 prompt prefix beyond hono's, which carries no guidance.
- **(c) everything else**: the app's own files, edits, codegen, typecheck,
  tests, gate. Actions the permission layer denied are kept inside (c) and
  shown apart.

Weighting is in dollars. The price vector ($2 input, $4 1h cache write,
$0.2 cache read, $10 output per MTok) reproduces every cell's
`total_cost_usd` exactly. Each action is charged:

- its output tokens;
- its result's tokens, written to the cache once and then re-read on every
  later call;
- a share of that call's re-read of the shared base prefix.

The buckets sum to each cell's cost, with a residual under $0.01. The script
header has the details. It also prints two variants:

- **Marginal (removal) estimate**: an action also carries its call's whole
  history re-read. This is what would disappear if the action were not
  taken.
- **Literal variant**: output plus the next call's whole input. Most of that
  input is history, so this variant mostly measures how late in the session
  an action happened.

## Per arm (N=3 medians)

| arm | cost | API calls | actions | (a) n | (b) n | (c) n | (a) $ | (b) $ actions | b-pushed $ | (c) $ | a/b/c share of action $ | marginal (a) / (b) $ | literal a/b/c | first edit (msg) | (a)+(b) $ before first edit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| guren shipped | 0.603 | 16 | 40 | 0 | 1.0 | 40.0 | 0.000 | 0.003 | 0.179 | 0.371 | 0/1/99% | 0.000 / 0.004 | 0/4/96% | 9 | 0.000 |
| guren shipped, `paths:` rules | 0.532 | 18 | 30 | 0 | 1.1 | 28.3 | 0.000 | 0.027 | 0.069 | 0.390 | 0/6/94% | 0.000 / 0.030 | 0/3/97% | 8 | 0.027 |
| guren bare | 0.706 | 32 | 52 | 4.0 | 6.0 | 42.0 | 0.031 | 0.092 | 0.004 | 0.491 | 6/18/77% | 0.055 / 0.115 | 14/20/62% | 11 | 0.048 |
| hono | 0.419 | 13 | 37 | 0 | 0 | 37.0 | 0.000 | 0.000 | 0.000 | 0.367 | 0/0/100% | 0 / 0 | 0/0/100% | 7 | 0.000 |
| guren july | 0.558 | 16 | 36 | 0 | 0 | 36.0 | 0.000 | 0.000 | 0.131 | 0.372 | 0/0/100% | 0 / 0 | 0/0/100% | 6 | 0.000 |

"msg" counts assistant events, as `summarize.ts` does. The first edit is
the first *successful* write; most arms' first attempt was a heredoc the
permission layer denied. Counts are fractional where one Bash command mixes
app reads with package reads.

**Gap to hono, arm means.** Unlike medians, means add up.

| bucket | shipped − hono | paths − hono | bare − hono | july − hono |
|---|---|---|---|---|
| (a) name confusion | 0.000 | 0.000 | 0.033 | 0.000 |
| (b) actions | 0.003 | 0.025 | 0.114 | 0.009 |
| (b) pushed guidance | 0.192 | 0.071 | 0.004 | 0.133 |
| (c) denied actions | −0.029 | −0.037 | −0.012 | −0.052 |
| (c) other | 0.071 | 0.060 | 0.100 | 0.036 |
| call-1 prefix, injections, text, residual | 0.007 | 0.033 | 0.025 | 0.003 |
| **gap** | **0.244** | **0.152** | **0.264** | **0.129** |

As shares of each gap:

- **shipped**: (a) 0%, (b) 80% (79% of it pushed guidance), (c) 17%.
- **paths**: (a) 0%, (b) 63% (47% pushed, 16% reads), (c) 15%, other 22%.
  Most of that "other" is rule text Claude Code attached after a file read,
  which lands in the injections bucket (+$0.032 over hono). Counted as (b),
  it brings (b) to about 80%.
- **bare**: (a) 12% (22% on the removal estimate), (b) 45%, (c) 33%.
- **july**: (b) pushed guidance is 103% of its gap. Its (c) runs below hono
  because fewer of its actions were denied.

## What the (a) actions were

Every (a) action belongs to one episode, and it recurs in all three bare
cells. The agent needed the options of the `paginate()` helper, which the app
imports from `@guren/core`. It grepped `@guren/core/dist` and found nothing,
because core's `.d.ts` re-exports server without declaring anything. It then
widened the search to `@guren/*` (bare-1 also read core's `package.json`
exports) and found the helper in
`@guren/server/dist/http/resources/Paginator.d.ts`:

- bare-1: 5 actions (msgs 37–42)
- bare-2: 4 actions (msgs 32–35)
- bare-3: 4 actions (msgs 33–36)

All 13 happen after the first edit, while the agent writes the controller.
The shipped, paths and july arms never searched. All three state the signature
(`paginate(result, { path?, query?, fragment? })` from `@guren/core`, "those
three fields are `PaginatorOptions`") in the SessionStart `guren context`
output and in `.claude/rules/orm-models.md`. No other core/server hop was
found. The
`belongsToMany` searches go from core to `@guren/orm`, which RFC 0024 does
not merge, so they are (b).

## Top files read under node_modules

- **guren shipped**: none.
- **guren shipped, `paths:` rules**: none.
- **hono**: none.
- **guren july**: `@guren/orm/dist/index.js` (3 actions, 1 cell: the
  `belongsToMany` pivot loader), `@guren/orm/dist/*.js` (1).
- **guren bare** (paths and globs as the agent typed them):

  | path | actions | cells |
  |---|---|---|
  | `@guren/orm/dist/index.d.ts` | 13 | 3 |
  | `@guren/core/dist/*.d.ts` | 8 | 3 |
  | `@guren/core/dist/index.d.ts` | 7 | 3 |
  | `@guren/core/dist` | 5 | 3 |
  | `@guren/*/dist` | 3 | 3 |
  | `@guren/server/dist/http/resources/Paginator.d.ts` | 3 | 2 |
  | `@guren/server/dist/http/resources/types.d.ts` | 3 | 3 |
  | `@guren/` | 2 | 2 |
  | `@guren/*/dist/*.d.ts` | 1 | 1 |
  | `@guren/core/dist/**/*.d.ts` | 1 | 1 |

  The orm reads were for `where` operators, `PaginateOptions`, `newQuery`
  and `getDatabase`. The core reads are the `paginate` hunt plus
  `belongsToMany` searches.

## Model API vs raw drizzle in the patches

The script counts markers in added lines of app code only. Schema and
migration files are excluded, because every arm writes drizzle there.

| cell | Model markers | drizzle markers |
|---|---|---|
| guren-shipped-1 / 2 / 3 | 6 / 5 / 6 | 0 / 0 / 0 |
| guren-shipped-paths-1 / 2 / 3 | 7 / 6 / 6 | 0 / 0 / 0 |
| guren-bare-1 / 2 / 3 | 5 / 5 / 6 | **15** / 0 / 0 |
| guren-july-1 / 2 / 3 | 6 / 9 / 6 | 0 / 0 / 0 |
| hono-sep-1 / 2 / 3 (control) | 0 / 0 / 0 | 9 / 9 / 9 |

- **Model markers**: `defineModel`, Model statics (`find`, `findOrFail`,
  `create`, `query`, `paginate`), `.with(`, relationships, and
  `attach`/`sync`.
- **drizzle markers**: `db.select`/`insert`/`update`/`delete`, an import
  from `drizzle-orm`, `eq`/`inArray`/`and`, and `getDatabase`.

Eleven of the twelve guren patches built tags on the Model API alone.
guren-bare-1 dropped to raw drizzle in `Tag.ts` (`getDatabase`,
`db.select`/`db.delete`, `eq`, `inArray`), after grepping the orm `.d.ts`
for `getDatabase`. Only five patches used `belongsToMany` (shipped-3,
paths-1, paths-3, july-1, july-2); the rest wrote the pivot by hand through a `PostTag` model.

## Reading

**The remaining gap is not name confusion.** In the shipped condition, which
is what a user of `agent:init` gets, (a) is zero in all three cells. In the
bare condition it is one recurring `paginate` hunt:

- 12% of the bare gap on the residency charge;
- about 22% ($0.052–0.069 per cell) on the removal estimate, which counts
  each of those single-grep calls as a whole context re-read.

Under the §6 rule, (a) is not the main cause in either arm.

**In the shipped arm, the gap is API learning paid up front.** The arm reads
almost nothing from `node_modules`. What it pays for is 25.5k tokens of
guidance, written into the cache at the start and re-read on each of its
16–24 calls: $0.18–0.22 per cell, about 80% of its gap to hono. The token
count matches the size of that guidance, at 2.38 characters per token:

- CLAUDE.md: 10.5 KB
- all six `.claude/rules/*.md` files: 42.1 KB. All six rule files appear to load at session start. The rules scope
themselves with a `globs:` frontmatter key. The Claude Code memory docs
(code.claude.com/docs/en/memory) say `paths` is the only field a rule is
read for, other fields are ignored without an error, and a rule without
`paths` loads at launch with CLAUDE.md's priority. Two measurements agree:

- the token arithmetic above, in both arms;
- the shipped arm's injections after edits stay small ($0.018 per cell
  against hono's $0.013), whereas attach-on-edit would add the rules there.

gurenjs `packages/cli/templates/agent/core/rules/*.md` uses `globs:` today.
On this reading the rules are about 70% of the pushed cost, roughly $0.13
per cell.

This contradicts PILOT.md round 5. That round explained the lost harness win
by rules that "auto-attach on edit". The round-5 app (37094d4) used the same
`globs:` key, so its rules were probably loaded at launch as well, unless
Claude Code treated the key differently in August. Round 5's working fix,
the signature digest in `guren context`, stands on its own measurement.

**In the bare arm, the gap is API learning pulled from dist, plus more
turns.** Bare runs 32 calls against hono's 13. It pays (b) $0.114 and (a)
$0.033 in reads, and (c) $0.100 more, mostly from those extra calls each
re-reading the base prompt.

**Implementation, (c), is a minor share of the gap wherever guidance is
pushed.** It is 17% in shipped, and july's (c) is lower than hono's. The
extra layers (model, validator, resource, pages, codegen) show up as a few
more calls, not as a cost that dominates.

**The pushed guidance roughly pays for itself.** Shipped and bare differ by
$0.02 on means ($0.675 vs $0.695) and by $0.10 on medians. The guidance
removes bare's (a), its (b) reads and half its calls, at about the price of
those reads. It is not dead weight, and dropping it brings back the
`paginate` hunt.

**Scoping the rules with `paths:` (the fifth arm).**

- **The saving comes from smaller startup guidance.** The call-1 prefix
  drops from 53.4k to 37.2k tokens. The part beyond hono's goes from 25.5k
  to 9.3k tokens: CLAUDE.md, the `guren context` output, and the skill and
  agent listings. That cuts the guidance loaded at start from $0.192 to
  $0.071 per cell (means).
- **Part of that is paid back.** The agents read the rules they were
  pointed to by hand: CLAUDE.md names `orm-models.md`, and all three cells
  `cat` it and/or `comments.md` before the first edit (+$0.021 in (b)
  reads). The rule text Claude Code attached itself adds +$0.032 in
  injections.
- **Net effect:** mean cost $0.583 vs $0.675 (−$0.092); median $0.532 vs
  $0.603. The gap to hono narrows from $0.244 to $0.152 on means.
- **The scoped rules did not arrive before the first edit on their own.**
  The stream does not show attached rule text, so this is read from token
  counts. In cells 1 and 3, the call after the one `Read` of `db/schema.ts`
  writes about 6.4k tokens that no tool result accounts for. That is the
  size of `orm-models.md`, `docs-and-spec.md` and `comments.md` together
  (about 6.9k tokens at 2.4 characters per token, all matching
  `db/schema.ts`). That `Read` came at msg 13 and msg 10, after the first
  edits at msg 11 and msg 8. Cell 2 never used `Read`, and nothing of that
  size appears in it.
- **`controllers-http.md`, `routes-codegen.md` and `testing.md` show no
  sign of arriving.** Files read through Bash `cat` and edited with `Edit`
  left no rule-sized writes. The one exception is an unexplained 3.6k-token
  write in cell 1 at msg 55, about the size of `testing.md`.
- **The round-5 worry did not recur.** No (a) and no `node_modules` reads
  showed up without the rules at launch. The SessionStart digest carries the
  signatures the agents need, and the one rule they want they `cat`
  themselves.
- **The ranges overlap.** Paths runs $0.53–0.68 against shipped's
  $0.60–0.82; paths-1 ($0.684) costs more than shipped-1 ($0.596). N=3
  shows the direction, which matches the $0.12 the accounting predicts. It
  does not show the size.

For RFC 0024 this points to the plan's second branch: leave 0024 where it
is, and work on the digest and rules. The fifth arm supports this and does
not contradict any earlier conclusion. Scoping the rules removes about 40%
of shipped's remaining gap to hono ($0.244 to $0.152 on means) without touching package names, and
(a) stays at zero. The next change to measure is the gurenjs template fix
(`globs:` to `paths:` in `packages/cli/templates/agent/core/rules/*.md`),
at a larger N, before any package merge. The guidance still has to carry
the `paginate` signature: bare is what happens without it.

## Limits

- **N=3 per arm.** Medians locate effects; they do not size them. Arm ranges
  overlap (shipped $0.60–0.82, bare $0.59–0.79).
- **Heuristic classification.** Bash commands are split at `;`, `&&`, `||`
  and newlines, and a mixed command's cost is split equally across its
  segments. A core miss hidden by other output in the same command is not
  detected. The (a) list was checked by hand against a full action dump:
  all 13 are the `paginate` hunt, and nothing else qualified.
- **Token attribution model.**
  - Output tokens per call are reconstructed from visible characters.
  - Result tokens use 2.4 characters per token, measured on this data.
  - The shared prefix re-read is split equally across the actions a call
    issued.
  - The literal variant from the brief is printed too. It puts (a) at 14–18%
    of bare's action tokens, because each hunt call arrives late with 60–80k
    tokens of history. Read the removal estimate for that effect in dollars.
- **Permission denials cost every arm $0.05–0.14 per cell** (heredocs with
  braces, `python3`). This is runner friction, not framework cost. It is
  roughly equal across arms, so it does not explain the gap, but it inflates
  every absolute number.
- **Cells in scope.** 15 Sonnet cells in five arms. The Opus 5.5 cells in
  `results/` are not included.
- **Rule attachment is inferred.** stream-json does not show the text Claude
  Code attaches for a path-scoped rule. Where and when rules arrived in the
  paths arm is read from unexplained cache writes, not observed directly.
