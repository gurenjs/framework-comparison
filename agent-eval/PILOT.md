# Agent-eval pilot — round 1 results (2026-07-12)

One trial per implementation. Model: `claude-sonnet-5`, headless Claude Code
(`--max-turns 120`, edits auto-accepted, Bash allowlisted). Task:
[TASK.md](./TASK.md) (add tags: schema, forms, display, `?tag=` filter,
validation, tests). Every trial started from a fresh worktree whose typecheck
and tests were verified green.

## Results

| | guren | hono | nextjs | tanstack | adonisjs | nestjs |
|---|---|---|---|---|---|---|
| Session end | max-turns | **success** | max-turns | success | max-turns | success |
| Turns | 121 | **70** | 121 | 136 | 121 | 90 |
| Wall clock (s) | 884 | **458** | 1,403 | 814 | 921 | 573 |
| Cost (USD) | 7.62 | **2.58** | 6.84 | 5.59 | 8.26 | 3.56 |
| Output tokens | 62.7k | **38.3k** | 66.1k | 58.8k | 60.2k | 42.4k |
| Implementation verified¹ | ✅ 15 tests | ✅ 27 tests | ✅ 36 tests | ✅ 40 tests | ✅ 24 tests | ✅ 5 suites |

¹ Patch applied to a fresh worktree; typecheck + full test suite re-run by the
harness (guren-1 additionally verified with a live HTTP smoke: tagged create,
`?tag=` filtering).

**Completion rate 6/6** — every agent produced a working, green
implementation.

## What round 1 actually measured (protocol flaw)

TASK.md's definition of done included "the feature works end-to-end in the
running app". Agents on JSON-API stacks (hono, nestjs) and tanstack could
self-verify cheaply with curl and finish. Agents on session/CSRF web-form
stacks (guren, nextjs, adonisjs) burned their remaining turns fighting CSRF
flows — two of them attempted to install Playwright — until the turn cap hit.
The end-state differences above therefore reflect **how hard each stack is to
smoke-test from curl**, not implementation efficiency.

## Round 2 protocol changes

1. Definition of done = typecheck + test suite only. Functional acceptance
   moves to the harness (hidden smoke per implementation, run after the
   session ends).
2. Report "turns/cost to green" (first state where typecheck + all tests
   pass), extracted from the event stream, alongside session totals.
3. N ≥ 3 trials per implementation; report medians and ranges. Single runs
   proved noisy — agents chose visibly different work orders per run.
4. Keep `--max-turns 120` as a safety cap; sessions should end well below it.

## Round 2 results (2026-07-13)

N=3 per implementation (one nestjs trial was killed by a transient API
disconnect and replaced), revised protocol: DoD = typecheck + tests, hidden
functional smoke run by the harness, `--max-turns 120`.

**Acceptance: 18/18 trials passed typecheck, the full test suite, and the
hidden `?tag=` smoke.** Every framework's agent shipped a working feature;
the differences are entirely effort.

Medians per implementation:

| | guren | hono | nextjs | tanstack | adonisjs | nestjs |
|---|---|---|---|---|---|---|
| Cost (USD) | 5.54 | **2.03** | 2.48 | 2.42 | 5.98 | 2.50 |
| Turns | 104 | **61** | 62 | 67 | 104 | 74 |
| Msgs to green | 156 | 90 | **89** | 93 | 164 | 105 |

(Ranges: guren 5.27–7.62 — one run hit max-turns after reaching green at
msg 221; tanstack 1.88–4.56; adonisjs 3.73–5.99; others tight.)

**Reading:** in this *bare-framework* condition, the two layered MVC
frameworks (Guren, AdonisJS) cost the agent ~2.2–2.9× more than the
colocated stacks. The same layering that minimized *human-typed* LOC in the
static comparison (migration → model → validator → controller → resource →
pages → codegen) is more files, more steps, and more convention-discovery
for an agent working without guidance.

**Condition caveat:** every implementation was measured with its scaffold's
agent-guidance files stripped (this repo gitignores `CLAUDE.md` /
`.claude/`). The guren agents never discovered `guren check` or
`guren context`; they found `bun run codegen` only via package.json. Guren's
(and increasingly Next.js's) actual shipped developer experience includes
those files — measuring them is round 3:

- **Round 3**: identical protocol, but each implementation gets exactly the
  agent-guidance files its own scaffold ships (guren: CLAUDE.md +
  .claude/skills; nextjs: CLAUDE.md/AGENTS.md from create-next-app;
  adonisjs: its starter's AGENTS.md; hono/nestjs/tanstack: none — that is
  their shipped default too). Hypothesis to test: guidance closes or
  reverses the layering gap.

## Round 3 results (2026-07-13) — shipped guidance restored

Same protocol as round 2; the only change is commit 434cfb4 restoring each
scaffold's shipped agent guidance (guren: CLAUDE.md + .claude/skills, with the
STUMBLES-driven expansion also proposed upstream in gurenjs#86; nextjs:
create-next-app's AGENTS.md/CLAUDE.md verbatim). hono/tanstack/adonisjs/nestjs
ship no guidance, so their round-2 numbers already represent their shipped
state. N=3 (trials 6–8), all 6 trials passed typecheck + tests + hidden smoke.

| median | guren r2 (bare) | guren r3 (guided) | nextjs r2 | nextjs r3 |
|---|---|---|---|---|
| Cost (USD) | 5.54 | **4.51** (−19%) | 2.48 | 2.50 (±0) |
| Turns | 104 | 95 | 62 | 65 |
| Msgs to first edit | 76–92 | **35–57** | — | — |
| Msgs to green | 156 | 143 | 89 | 92 |
| node_modules archaeology share | 17–46% | 17–27% | ~0 | ~0 |

**Reading:** guidance works — time-to-first-edit halved, cost −19% — but the
gap to the colocated stacks remains ~1.8×. nextjs acts as the control: adding
its shipped guidance changed nothing because API knowledge was never its
bottleneck. Residual guren cost: agents still verify exact type details in
dist .d.ts (`PaginatorOptions`, `BelongsToManyRecord`, TestApp assertion
signatures) and re-excavate api-client codegen behavior; the .claude/skills
were invoked 0–1 times per run (pull-based guidance goes unused).

**Round 4 (planned):** replace fat-CLAUDE.md with lean CLAUDE.md +
glob-scoped `.claude/rules/*.md` carrying exact, source-verified signatures —
push-based and context-targeted, matching how agents actually consume docs.

## Round 4 results (2026-07-13) — lean CLAUDE.md + glob-scoped rules

guren only (trials 9–11), guidance v2 from gurenjs#86 commit 0f2e071:
CLAUDE.md slimmed 295→173 lines, deep API reference moved to four
glob-scoped `.claude/rules/*.md` files with source-verified exact signatures.
All 3 trials passed typecheck + tests + hidden smoke.

| guren median | r2 bare | r3 fat CLAUDE.md | r4 rules |
|---|---|---|---|
| Cost (USD) | 5.54 | 4.51 | **3.35** |
| Turns | 104 | 95 | **77** |
| Msgs to green | 156 | 143 | **109** |
| vs hono ($2.03) | 2.7× | 2.2× | **1.65×** |
| vs nextjs ($2.48) | 2.2× | 1.8× | **1.35×** |

Best single run (guren-11): $2.87, 69 turns — inside the colocated stacks'
range. The remaining archaeology share held at ~19–30%, but sessions got
much shorter: with exact signatures pushed into context, the verification
detours that remain are brief confirmations rather than exploratory digs.

**Conclusion of the guidance arc:** documentation placement alone moved
Guren from 2.7× to 1.65× the cheapest stack — a 40% cost reduction with
zero framework-code changes — and every trial across all four rounds
shipped a working feature. The residual gap now plausibly reflects real
structural cost (more layers per feature) plus remaining unknown-API tax;
further reduction likely needs the ORM/API additions in the backlog
(firstOrCreate, pivot helpers) rather than more docs.

## Round 5 results (2026-08-01) — re-measurement on current releases

The framework moved a lot since round 4 (rc.11 → cli 1.6.0 / core 1.4.0 /
orm 1.3.0, Inertia v3, and the full `agent:init` harness with hooks, skills,
and glob-scoped rules), so before publishing any number we re-measured on the
updated app (commit 37094d4). Same protocol: `claude-sonnet-5`, N=3 medians,
blind scoring. Note the host environment also changed since July (more
user-level plugins/hooks in context), so absolute costs are not comparable
across rounds — arms within a round are.

| guren median | r5 bare | r5 shipped harness (as released) | r5 + signature digest (gurenjs#279) |
|---|---|---|---|
| Cost (USD) | 6.26 | 6.08 | **4.99** |
| Turns | 94 | 102 | **81** |

All 9 trials passed typecheck + tests + hidden smoke (39/39 lifetime).

**The released harness's cost win had evaporated (−3%)** — stream analysis
showed why: the round-4 win came from agents reading the rule files, but the
current harness delivers rules as glob-scoped auto-attach on *edit*, while
~75% of `node_modules` archaeology happens *before* the first edit. Skills
went unused (0 invocations, again), and the CLAUDE.md pointer to the rules
was ignored. Push beats pull, and attach-on-edit is pull with extra steps.

**The fix (gurenjs#279) pushes a static API-signature digest into the
`guren context` output**, which the harness's SessionStart hook already
injects — signatures arrive before any work starts. Result: first edit moved
from tool ~46 to ~34, pre-edit archaeology dropped 23–24 → ~10 actions, and
the arm medians landed at −20% cost / −14% turns vs bare. Best run: 61 turns,
$3.77. (Trials 18–20 deliver the digest as a committed file appended by the
SessionStart hook — byte-identical to what the post-#279 `guren context`
emits — because the released cli 1.6.0 predates the digest and the unreleased
cli needs unreleased core internals.)

**Reading:** the 40% arc of rounds 2→4 does not survive contact with the
current, heavier environment; −20% with the digest is the honest number until
the next release ships #279 and a scaffold-exact re-run confirms it. The
per-trial spread (3.77–5.76 vs bare 4.47–10.04) still overlaps: N=3 medians
locate the effect, they do not size it precisely.

## Operational notes

- Trials are disk-hungry (a worktree + node_modules each); run sequentially
  and delete worktrees after saving the patch (`run-trial.sh` does this now).
- The harness doubles as an onboarding reproducibility test: it exposed a real
  fresh-clone setup gap in the AdonisJS implementation (gitignored `tmp/` and
  `.adonisjs/` registries), fixed in ecc3ad1.
