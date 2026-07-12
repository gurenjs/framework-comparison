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

## Operational notes

- Trials are disk-hungry (a worktree + node_modules each); run sequentially
  and delete worktrees after saving the patch (`run-trial.sh` does this now).
- The harness doubles as an onboarding reproducibility test: it exposed a real
  fresh-clone setup gap in the AdonisJS implementation (gitignored `tmp/` and
  `.adonisjs/` registries), fixed in ecc3ad1.
