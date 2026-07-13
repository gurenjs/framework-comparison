# Agent evaluation: what does the same feature cost an AI agent on each framework?

We gave the same task — add a complete tagging feature (schema, forms,
display, `?tag=` filtering, validation, tests) to the Minilog blog app — to
[Claude Code](https://claude.com/claude-code) (claude-sonnet-5, headless,
`--max-turns 120`) on all six implementations in this repo, three trials
each, and measured what it cost.

**Scoring is fully automated and blind.** Each trial starts from a fresh
worktree whose typecheck and test suite are verified green. After the
session, the harness applies the agent's patch to another fresh worktree and
re-runs typecheck + the full test suite, plus a **hidden functional smoke**
the agent never saw: seed data directly in SQLite, boot the app, and verify
`?tag=` filtering over real HTTP.

## Headline results

**Every framework shipped.** 30/30 scored trials across all rounds passed
typecheck, the full test suite, and the hidden smoke. Modern agents complete
this feature on any of these stacks; the differentiator is cost.

Shipped-state medians (each framework exactly as its scaffold ships, N=3):

| | hono | tanstack | nextjs | nestjs | guren¹ | adonisjs |
|---|---|---|---|---|---|---|
| Cost (USD) | **2.03** | 2.42 | 2.48 | 2.50 | 3.35 | 5.98 |
| Turns | **61** | 67 | 62 | 74 | 77 | 104 |

¹ guren with the agent guidance its scaffold now ships
([gurenjs#86](https://github.com/gurenjs/guren/pull/86)); see the arc below.

## The interesting part: why the gap, and what closes it

Guren started at **$5.54 median (2.7× hono)** when measured bare. Stream
analysis ([STUMBLES.md](./STUMBLES.md)) showed the implementation itself was
fast and error-free — agents spent **17–46% of all tool actions
reverse-engineering `@guren/*` APIs out of `node_modules` dist bundles**,
because the model doesn't know Guren from training data the way it knows
hono or Next.js. The gap was knowledge acquisition, not framework friction.

So we fixed the docs and re-measured:

| guren median | bare | + fat CLAUDE.md | + lean CLAUDE.md & glob-scoped rules |
|---|---|---|---|
| Cost | 5.54 | 4.51 | **3.35** |
| Turns | 104 | 95 | **77** |
| Msgs to first edit | 76–92 | 35–57 | 33–65 |

Two findings we believe generalize beyond Guren:

1. **Push beats pull.** Auto-loaded guidance (CLAUDE.md, glob-scoped
   `.claude/rules/`) changed agent behavior; skill files the agent must
   choose to invoke were used 0–1 times across every run.
2. **The control matters.** Next.js ships its own agent guidance
   (AGENTS.md/CLAUDE.md); restoring it changed nothing (±0) — guidance only
   pays where the model lacks API knowledge. Training-data familiarity is a
   real, measurable moat for established frameworks, and documentation
   engineering is how a young framework rents it back.

## Honest limitations

- One model (claude-sonnet-5), one task, N=3 — medians are stable but this
  is not a benchmark suite.
- Frameworks the model knows from training data have a structural advantage
  no scaffold can fully erase; that advantage is part of what we measured.
- The task favors nothing intentionally, but any single task has a shape.
  Read [TASK.md](./TASK.md) and judge.

## Reproduce

```bash
# one trial (fresh worktree, pre-check, agent session, patch saved)
bash agent-eval/run-trial.sh guren 12

# score it (typecheck + tests + hidden smoke on a clean worktree)
bash agent-eval/verify-trial.sh guren 12

# aggregate session metrics + turns-to-green from the event streams
bun agent-eval/summarize.ts 12
```

Requires Claude Code with an API key; each trial costs roughly $2–6.
Full lab notes: [PILOT.md](./PILOT.md) (round-by-round results, protocol
changes, and the operational gotchas we hit).
