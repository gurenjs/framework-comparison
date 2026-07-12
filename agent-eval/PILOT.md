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

## Operational notes

- Trials are disk-hungry (a worktree + node_modules each); run sequentially
  and delete worktrees after saving the patch (`run-trial.sh` does this now).
- The harness doubles as an onboarding reproducibility test: it exposed a real
  fresh-clone setup gap in the AdonisJS implementation (gitignored `tmp/` and
  `.adonisjs/` registries), fixed in ecc3ad1.
