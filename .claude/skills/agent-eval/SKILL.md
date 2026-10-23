---
name: agent-eval
description: Run, cost, grade and analyze the Guren-vs-Void agent eval in void-eval/ (overlays, seeded hidden defects, spend, re-grading saved patches, free re-audits). Use when measuring a Guren harness or audit change against Void.
---

# Guren vs Void agent eval (void-eval/)

The report is `AGENT-EVAL-VOID.md`. Write new results there as a dated section, not in chat only.

## Rules before any run

- **Paid runs need a cost estimate and an explicit go-ahead first.** Estimate from earlier cells, which are measured, not guessed:
  - Sonnet 5.5 Stage 2 cell: about $0.35–0.45 for Guren and $0.25 for Void.
  - Haiku 5.5 cell: about $0.03–0.06.
  - Set `SPEND_CAP` on round scripts.
- **Compute cost with `python3 harness/spend.py <results dir>`, never `total_cost_usd`.** Claude Code 2.1.289 prices Haiku at Sonnet rates, and 2.1.304 reads about 20% under token-priced Sonnet. `spend.py` holds the per-model prices.

- **Nothing unpublishable gets pushed.** `scripts/check-public.sh` rejects local paths, Claude Code session data, credentials and personal addresses in tracked files and new commit messages. It runs from `.githooks/pre-push` (enable with `git config core.hooksPath .githooks`) and from the `public-check` workflow on every PR. Results are kept clean by `harness/sanitize-results.py`, which `run-cell.sh` applies; run it by hand on any result file written another way.

## Equal conditions (round 2 on)

| knob | value | why |
|---|---|---|
| `GUREN_BASE=c0a533c` | agents-on-guren-app `eval/lean-pages` | Guren pages made as lean as Void's (`harness/lean-pages.py`) |
| `GUREN_PREAMBLE=typecheck-only` | `harness/PREAMBLE.guren.typecheck-only.md` | Void's definition of done (typecheck only, no tests required) |
| Void cells | reused from `results/` (round 1) | app, preamble and Claude Code version unchanged |
| `GUREN_BASE=525c19c GUREN_UPDATE=none`, arm `guren-shipped` (round 5) | agents-on-guren-app `eval/v2310`: create-guren-app 1.19.0, lean pages, its own lock (@guren/cli 2.32.0) | today's template and shipped harness, no overlay; references in `tasks-guren-v2310/` |

The five Stage 2 tickets are `post-tags`, `comments-moderation`, `post-revisions`, `json-api-tokens` and `scheduled-publish`.

## Arms and harness overlays

- Arm `guren-<variant>` is pinned `@guren/cli` 2.31.1 with `overlays/guren-harness-<variant>/` laid over `templates/agent` (`GUREN_TEMPLATE_OVERLAY`, `resolve_arm` in `harness/lib.sh`).
- The overlay's `.SOURCE` file names the gurenjs commit it came from.
- To test a template change, copy the gurenjs `packages/cli/templates/agent/` tree into a new `overlays/guren-harness-vN/`, write its `.SOURCE`, and add the arm.
- An overlay carries templates only. A change in CLI source (the `gate`, `audit` or `context` code) is not in the arm unless the pinned CLI already has it.

## Running

```bash
cd void-eval
export GUREN_BASE=c0a533c GUREN_PREAMBLE=typecheck-only
RESULTS=$PWD/results-round2 bash harness/run-matrix.sh --tasks post-tags --arms guren-v4 --models claude-sonnet-5-5 --trials 3
```

- One cell is `harness/run-cell.sh <task> <arm> <model> <trial>`, then `harness/verify-cell.sh` with the same arguments.
- Round scripts (`run-round3.sh`, `run-round4.sh`, `run-v4cost.sh`, `run-round5.sh`) are the templates for a new round: one script per round, a header comment saying what it measures, and a `SPEND_CAP`.
- Each cell writes `<cell>.stream.jsonl`, `.result.json` and `.patch`, and verification writes `.verdict.json`. Only the streams and stderr logs are gitignored. Commit the rest of a round's results with its report section.
- Wait on a background run by counting result files. A `pgrep` loop matches its own command line.

## Hidden-defect tasks

- `tasks/<base>-{authz,dauthz,eauthz,mass}` are Stage 2 tickets over a seeded defect the statement never names. They seed update authorization, delete authorization, the edit page's GET and a mass-assignable `authorId`, in that order.
- Seeds live at `tasks/<id>/seed.guren.patch` and `seed.void.patch`.
- The selection rules and the validation are in `tasks/_seeds/README.md`. Follow them for a new class:
  - same defect in both apps;
  - in code the ticket must change;
  - graded by a framework-neutral HTTP check in `suite/lib/*.ts`;
  - validated with reference ± fix before any paid cell.
- Drop a task whose defect disappears in one arm's reference, as `post-revisions-mass` did for Void.
- Include a control: a class no Guren detector reads, to tell a verification effect from an agent effect.

## Grading and analysis (free)

- `suite/regrade-extras.sh <results dir> <guren base> <out tsv>` re-grades saved patches against `tests/extras/`. `suite/run-extras-on.sh <arm> <task> [patch]` does one.
- Patches are applied with `--exclude=".guren/*"`, because generated files do not apply.
- `python3 harness/analyze-round2.py` prints the cost, context and turns table for the round-2 arms. To add a variant, extend `ARMS`.
- `python3 harness/analyze-defects.py` prints defects fixed per class, model and arm, from `results-round{3,4}/EXTRAS.tsv`.
- `python3 harness/stop-blocks.py <results dir> <arm>` shows why the Stop hook blocked in each cell. Read it before claiming a hook's cost or precision.

## Re-auditing saved patches with an unreleased audit rule (free)

This is how to check a `guren audit` rule's precision without paid cells.

1. Build the seeded start state, `make_start_state guren <task> <dir>` from `harness/lib.sh`, and apply the cell's patch with `git apply --exclude=".guren/*"`.
2. Give it `node_modules`. Without them, `guren audit` analyzes no routes and every policy finding silently disappears. Symlink a base install instead of installing per patch.
3. Run a gurenjs checkout's CLI against it: `bun <gurenjs>/packages/cli/src/bin.ts audit --json`.
4. Check that seeded starts still warn. A rule change that silences the seeds is a regression, whatever it does to the false positives.
5. Before reporting a false-positive count, read the actual Stop-hook messages (`stop-blocks.py`, or grep the streams). Final patches may already contain the fix the warning asked for.

## Reporting

- Tables carry n, arm, model and conditions. Say when n=3 variance exceeds the effect, as with round 1 v1.
- State what favours Guren up front: v4 is the change that delivers an audit finding to the agent, and Void has no equivalent.
- Put tables in `AGENT-EVAL-VOID.md`.
