# Agent eval: Guren (with its harness) vs Void

Five rounds, 2026-10-19 to 10-23, on Claude Sonnet 5.5 and Haiku 5.5. The
summary comes first; each claim points at the round that measured it.

- **On ordinary tickets the pass rate does not differ.** Every cell of the five
  Stage 2 tickets passed on both frameworks and both models, in rounds 1, 2
  and 5. Re-grading 90 saved patches against robustness checks the graded
  tests skip found one failure, a round-2 Guren cell on the 2.31.1 harness;
  every other patch on both frameworks passed (round 3).
- **Cost, with conditions equal: Guren is about 1.4× Void per cell.**
  - Round 1's 2.2× (median $0.55 vs $0.25) came partly from two eval choices
    that favoured Void: only the Guren prompt asked for tests, and the Guren
    app's pages were larger.
  - Round 2 removed both: typecheck is the definition of done for both arms,
    and the Guren pages were slimmed.
  - Round 5 then used the published Guren release (create-guren-app 1.19.0,
    @guren/cli 2.32.0, with its own harness). Guren's median was $0.347 per
    cell against Void's $0.254: 1.37× the median and 1.58× the total ($6.09 vs
    $3.85). Most of the total gap is one ticket, json-api-tokens. Round 5 ran
    on Claude Code 2.1.304 and Void's cells on 2.1.289, so the ratio spans two
    Claude Code versions.
  - Where the rest goes: about 7k more tokens of context at session start, and
    about 11k more per call from the framework layers the agent reads.
- **Seeded defects: Guren wins where its bundled detector reads the defect
  (rounds 3 and 4).** We removed one authorization check from both apps.
  - Haiku 5.5: Guren fixed 18/18 across the update and delete classes, Void
    6/18.
  - In each Guren cell that fixed it, the Stop hook had named the action from a
    `guren audit` finding, and the agent's next edit restored the check.
    We found no equivalent check in Void 1.1.11's CLI or docs.
- **With no detector, there is no difference.**
  - Edit-page (GET) authorization: Guren 0/6, Void 1/6 (Haiku).
  - Sonnet 5.5 found the missing update authorization on its own in both arms
    (9/9 and 9/9).
- **Discount the mass-assignment result.** Guren fixed a mass-assignable
  `authorId` 5/6, Void 0/6. No Guren rule reads that defect. The agents
  followed the advice of a neighbouring force-write warning in the old app's
  `PostController.store`. Today's template no longer produces that warning, so
  the result should not be expected there (not re-measured).

What the evidence supports: **Guren's bundled detectors, delivered to the
agent by its harness, change the outcome for the defect classes they read.**
It does not show that agents are more careful on Guren. How the seeds were
chosen (same defect in both apps, in code the ticket changes, rules written
before any cell ran) is in
[`void-eval/tasks/_seeds/README.md`](void-eval/tasks/_seeds/README.md).

Read the caveats before quoting a number:

- n=3 per cell;
- five tickets;
- a Void app written by us, about a third the size of the Guren app;
- Claude Code 2.1.289, except round 5 (2.1.304);
- Haiku costs priced by `harness/spend.py`, since Claude Code 2.1.289 prices
  Haiku at Sonnet rates.

[TYPECHECK.md](TYPECHECK.md) is a separate benchmark of `tsc` cost, with no
agents. It uses the same Void release (1.1.11). Its Guren app is
create-guren-app 1.18.4 (@guren/cli 2.31.1); this eval uses 1.17.2 and, in
round 5, 1.19.0. No figure here depends on it, and none contradicts it. Below, Question through the
Haiku section describe round 1; rounds 2 to 5 follow in order.

## Question

Guren's main pitch for agents is that they can write the app *and* the
result is checked: typecheck, `guren check`/`gate`, and tests, which the
shipped harness runs from hooks. The existing agents-on-guren numbers compare
Guren with its harness against Guren without it.

Void (VoidZero / Cloudflare) builds on the same idea:

- Vite + Hono + Drizzle on Workers
- docs bundled in `node_modules/void/docs/`
- an `AGENTS.md` and two skills from `void init`

The question here: on the same work, do agents do better on Guren than on
Void?

## Setup

| | Guren arm | Void arm |
|---|---|---|
| App | `agents-on-guren-app` at 0fd1654 (create-guren-app 1.17.2), then `bun update` to the current releases (@guren/cli 2.31.1); round 5 rebuilds it on create-guren-app 1.19.0 | `void-eval/app`: the same blog, written by us on Void 1.1.11 |
| Scaffold | `create-guren-app --blueprint blog --db sqlite` | `npx void@1.1.11 init`: Vite+, React, D1 (SQLite), no deployment target |
| Agent guidance | `bunx guren agent:init --target claude`: CLAUDE.md, 6 path-scoped rules, 10 skills, SessionStart/PostToolUse/Stop hooks | what `void init` installs: a 2-line `AGENTS.md` that points at `node_modules/void/docs/`, plus the `void` and `migrate-vite-cloudflare-to-void` skills |
| Prompt | agents-on-guren `PREAMBLE.md` + `statement.guren.md` (verbatim agents-on-guren statement) | same preamble with "`pnpm typecheck` passes" as the definition of done + `statement.void.md` (Void URLs and response shapes) |
| Pass gate | black-box suite **and** `bunx tsc --noEmit` | black-box suite **and** `pnpm typecheck` (`void prepare && tsc --noEmit`) |

The runner is the same for both arms: headless Claude Code 2.1.289,
`--max-turns 200`, `--strict-mcp-config`, `--setting-sources project,local`,
auto memory off, and no WebFetch/WebSearch. The Bash allowlist is the union
of what either framework tells an agent to run. Denied in every spelling:
`void deploy`, `connect`, `login`, `secret`, `platform`, `project`. The arm
order alternates by trial, so neither arm always writes the shared prompt
cache for the other.

### The Void app, and why it is a confound

No third-party Void blog exists, so we wrote one. It mirrors the Guren app
route for route, written the way the Void docs show:

- pages with `.server.ts` loaders and actions
- `withValidator` with zod
- named actions `?update` / `?delete`
- Void-managed Better Auth
- Drizzle via `void/db`

The two apps are not the same size:

- **Guren app:** 40 files, 61k characters of source.
  - 34k of it is React pages, 10k of that Tailwind class strings.
  - About 7k is comments.
  - Behind each feature sit a controller, a validator, a resource, a policy
    and a model.
- **Void app:** 26 files, 20k characters, unstyled.

Agents read what is there, so part of Guren's extra cost below is this size
difference and not the framework. Some of it is the blueprint (styling,
comments), and some is Guren's layering. The two cannot be separated without
a slimmer Guren blueprint arm, which this round does not include.

### Tasks: five Stage 2 tickets

The agents-on-guren Stage 2 corpus has nine product tickets that each span
three or more subsystems. These five can be graded the same way on both apps
over HTTP plus pinned table names:

| ticket | statement differences for Void (full list in `tasks/<id>/PORTING.md`) |
|---|---|
| post-tags | "props" become "page data". An invalid tag list gets the same response as an empty title (Void: 200 page data with `errors`). |
| comments-moderation | The comment endpoint is a named action, `POST /posts/:id?comment`. A guest is sent to `/login` "like a guest opening `/posts/create`". |
| post-revisions | "props" become "page data". The guest wording points at the edit page. |
| json-api-tokens | Invalid input may answer 400 **or** 422 (Void route validators answer 400). Author ids are strings. |
| scheduled-publish | Edit is `PUT /posts/:id?update`. Search is `GET /posts?q=`. The ops console report is removed from **both** arms, because Void has no comparable console-command facility. |

The other four are left out because they test Guren's own machinery:

- newsletter-module (modules)
- posts-agent-tool (agent routes)
- locale-switch (i18n catalog)
- cover-attachment (storage layout)

Where the tickets are not equal:

- **json-api-tokens: more hand-written code on Void.** Guren ships token,
  bearer and rate-limit helpers. On Void the agent writes the hashing, the
  Bearer parsing and the limiter.
- **scheduled-publish: less work on Void.** One loader serves both the list
  and search; Guren has three actions to keep consistent.
- **comments-moderation, post-revisions: a little extra work on Void.** A
  guest must be redirected, but Void's `requireAuth` answers 401.

### Grading: one suite, two drivers

The agents-on-guren hidden tests run in-process against `@guren/testing`, so
they cannot grade Void. `void-eval/suite/` holds black-box tests that are the
same for both apps. Each test:

- boots the app on an empty database;
- registers and signs in over HTTP;
- acts through the app's own forms and routes;
- reads page data;
- checks the pinned tables through SQLite.

Framework specifics live in the drivers:

- `drivers/guren.ts`: CSRF, Inertia JSON.
- `drivers/void.ts`: `Origin`, `X-VoidPages` page JSON, named actions.
- `drivers/ext/<ticket>.ts`: per-ticket helpers.

A validation failure counts as "rejected with field errors" in each
framework's own shape: Guren answers 422 JSON, Void answers 200 page data
with `errors`.

Validation gate, before any agent ran. The start state must fail and the
reference must pass, 2× each, on both apps:

- Guren reference: agents-on-guren `reference.patch`.
- Void reference: `reference.void.patch`, written for this eval.

Every Void reference was also broken 2–3 ways (a dropped auth check, a
dropped filter, a loosened validator) to check that the suite catches it. All
ten gates passed. Logs and tables are in each `tasks/<id>/PORTING.md`.

## Results

| ticket | arm | pass | turns | input tokens (med) | output tokens (med) | cost (med) | wall s (med) | cells that added tests |
|---|---|---|---|---|---|---|---|---|
| post-tags | Guren | 3/3 | 24, 23, 24 | 1158k | 11.0k | $0.56 | 167 | 3/3 |
| post-tags | Void | 3/3 | 15, 10, 13 | 422k | 5.9k | $0.22 | 66 | 0/3 |
| comments-moderation | Guren | 3/3 | 33, 21, 23 | 1130k | 10.8k | $0.55 | 140 | 3/3 |
| comments-moderation | Void | 3/3 | 24, 24, 19 | 581k | 8.2k | $0.30 | 90 | 0/3 |
| post-revisions | Guren | 3/3 | 19, 18, 15 | 450k | 5.6k | $0.30 | 170 | 0/3 |
| post-revisions | Void | 3/3 | 20, 24, 15 | 385k | 6.5k | $0.21 | 73 | 0/3 |
| json-api-tokens | Guren | 3/3 | 42, 39, 46 | 1959k | 14.3k | $0.86 | 375 | 3/3 |
| json-api-tokens | Void | 3/3 | 17, 23, 15 | 431k | 8.0k | $0.27 | 123 | 0/3 |
| scheduled-publish | Guren | 3/3 | 17, 16, 22 | 801k | 7.7k | $0.38 | 153 | 2/3 |
| scheduled-publish | Void | 3/3 | 24, 14, 19 | 518k | 6.6k | $0.25 | 82 | 0/3 |
| **all** | **Guren** | **15/15** | median 23, mean 25.5 | 1124k | | $0.55 (mean $0.53) | | 11/15 |
| **all** | **Void** | **15/15** | median 19, mean 18.4 | 467k | | $0.25 (mean $0.26) | | 0/15 |

Total: $11.86 API-equivalent for 30 cells. One Void cell first failed on a
harness bug: the suite's retry for a known `vp dev` error page missed a
leading newline. The same patch was regraded after the fix and passed
10/10. The original verdict is kept as `*.verdict.harness-bug.json`.

### Same features, more code on Guren

- **UI:** both arms changed the same number of UI files on every ticket, so
  neither skipped the forms.
- **Hand-written added lines (median per cell):** Guren 214, Void 121. Counted
  by `analyze.py` with generated files excluded: migrations and Drizzle
  snapshots, `.guren/*.gen.ts`, `docs/spec/`, lockfiles.
- **Where the difference comes from:**
  - tests: 690 lines over 15 Guren cells, none on Void;
  - more layers per feature (controllers 739 lines, validators 138,
    middleware 107);
  - longer page markup (UI lines: Guren 54, Void 31 median).
- **What the black-box suite sees:** the same behaviour from both. Guren's
  extra code is structure and tests, not extra features.

### Where Guren's extra tokens go

The gap is mostly context per turn, not turns: about 49k input tokens per
turn on Guren against 25k on Void. Reading the cells' event streams with `harness/analyze.py` (output in
`results/ANALYSIS-STAGE2.md`) and `harness/probe-context.sh`, it breaks
down like this. Items 1, 2, 4, 5 and 6 are measured. Item 3 is inferred from
tool-output sizes.

1. **Session start: +7k tokens.** A one-turn probe in each start state
   measured 35.6k on Guren (CLAUDE.md, SessionStart "Project Context", 10
   skill descriptions) and 28.4k on Void. Every turn carries it.
2. **Path-scoped rules that attach mid-session: about 4–8k per kind of
   file.** The six rules total 43k characters (`controllers-http` 10k,
   `orm-models` 10k, `testing` 9k, …). `probe-context.sh` reads one file in
   the Guren start state and reports the context afterwards
   (`logs/probe-context-guren-2026-10-19.log`):

   | file read | file size | context after the read |
   |---|---|---|
   | README.md | 1.2k chars | +0.7k tokens (the file alone) |
   | app/Http/Controllers/PostController.ts | 3.8k chars | +8.5k |
   | app/Models/Post.ts | 0.7k chars | +7.1k |
   | tests/PostController.test.ts | 0.8k chars | +4.7k |

   A ticket that touches controllers, models, routes and tests carries all of
   them on every later turn. In the `post-tags` trace, one `cat` of four
   Guren files added 15.5k tokens; on Void the largest single jump was 6k.
3. **A bigger app to read.** Guren cells' file reads and `cat`s returned
   about 9k characters per cell; Void cells' returned 1k. This is mostly the
   confound above. Guren's codegen and migration commands also print more
   (20k vs 7k characters per cell).
4. **Tests the agents wrote.** Guren agents added tests in 11/15 cells and
   ran `bun test` in 15/15. Void agents wrote none: the app has no test
   runner, and the Void docs describe no testing story for apps. Part of
   this is the eval's design, not Guren's nature: the Guren preamble's
   definition of done says "`bun test` (the project's existing test suite,
   plus any tests you add) passes", and the Void preamble has no such line.
   - The ticket without tests shows the size of this effect. post-revisions
     had no test cells and only a 1.17× token gap. post-tags and
     comments-moderation had tests in every Guren cell and gaps of 2.7× and
     1.9×.
5. **Hunting for an undocumented API (json-api-tokens: 4.5×).** Guren cells
   on this ticket read `node_modules/@guren/server` and `core` dist files
   about 10 times each. They grepped for `createApiToken`, `MemoryRateLimitStore`,
   `createRateLimitMiddleware`, `Retry-After`, CSRF options and bearer
   handling. The harness mentions API tokens in one line
   (`this.apiToken()` in `rules/controllers-http.md`). It says nothing on
   issuing or storing tokens, wiring the bearer middleware, rate limiting,
   or exempting bearer routes from CSRF. Guren has all of these features, but
   the agents had to reverse-engineer them.
6. **PostToolUse blocks: 33 in 15 Guren cells.** Most were mid-edit states:
   - "Route graph … failed to load: X is not defined": 20 blocks. The agent
     had wired a route before writing the schema or controller it imports.
   - oxlint "imported but never used" warnings on a half-written file.

   After most blocks the agent's next action was the edit it had planned
   anyway. One kind of block is different: "routes/api.ts exports a route
   registrar that nothing reachable from routes/web.ts calls". That is a
   real defect a typecheck does not catch. It fired 3 times, all in one
   json-api-tokens cell, and the agent wired `routes/web.ts` within its next
   three edits. The stream cannot tell whether the agent would have done so
   unprompted.

### Verification: done, but no visible effect on the outcome

- **Tests:** as far as the (often `| tail`-truncated) outputs show, in no
  Guren cell did a failing `bun test` lead to a source change (0/15).
- **The gate:** the Stop-hook gate ran in all 15 Guren cells and blocked 0.
- **Edit-time checks:** the PostToolUse check caught one real defect, an
  unmounted route file (see 6 above). That is the only observed case where
  Guren's verification may have changed the result.
- **Booting the app:** no agent in either arm started the app to check its
  work.
- **Typecheck:** every cell in both arms ran it.

On Sonnet 5.5 and these tickets, Guren's extra verification bought no
measurable difference in pass rate. The black-box suite passed Void's unverified
patches just as often. The verification pitch might still pay where models make
more mistakes. In agents-on-guren Stage 2, Haiku 4.5 moved from 30% bare to
44% shipped. The Haiku 5.5 run below tested that, and found no pass-rate
difference there either.

### What this does and does not show

- **Success rate:** no claim that Guren beats Void follows from this round.
- **Cost:** Guren's cost on the same tickets is about 2×, and the reasons
  above are measured, not guessed.
- **Not a measure of the framework alone:** the comparison mixes framework,
  harness, app size (our Void app is lean) and agent behaviour (tests). Item
  3 in particular inflates the gap against Guren.
- **Sample size:** n=3 per cell, one model, and ranges that sometimes
  overlap (comments-moderation turns: 21–33 vs 19–24). The medians locate
  the effect; they do not size it precisely.

## Haiku 5.5 (same 30 cells, 2026-10-19)

The same five tickets × 2 arms × 3 trials on `claude-haiku-5-5`. Every cell
passed again (30/30). Per-ticket tables are in
`results/ANALYSIS-STAGE2-haiku55.md`, produced by
`env MODEL=claude-haiku-5-5 python3 harness/analyze.py`.

| ticket | arm | pass | turns | input tokens (med) | output tokens (med) | cells with tests | hand-written lines (med) |
|---|---|---|---|---|---|---|---|
| post-tags | Guren | 3/3 | 70, 65, 58 | 4455k | 40.8k | 3/3 | 297 |
| post-tags | Void | 3/3 | 41, 44, 35 | 1873k | 22.6k | 0/3 | 139 |
| comments-moderation | Guren | 3/3 | 39, 41, 56 | 2621k | 35.1k | 3/3 | 399 |
| comments-moderation | Void | 3/3 | 42, 49, 32 | 1894k | 22.9k | 0/3 | 218 |
| post-revisions | Guren | 3/3 | 31, 34, 27 | 1993k | 18.4k | 3/3 | 271 |
| post-revisions | Void | 3/3 | 24, 30, 30 | 1110k | 14.7k | 0/3 | 114 |
| json-api-tokens | Guren | 3/3 | 52, 56, 44 | 4542k | 42.3k | 3/3 | 369 |
| json-api-tokens | Void | 3/3 | 38, 27, 19 | 990k | 21.1k | 0/3 | 210 |
| scheduled-publish | Guren | 3/3 | 58, 61, 53 | 3191k | 32.3k | 3/3 | 205 |
| scheduled-publish | Void | 3/3 | 32, 33, 34 | 1911k | 22.8k | 0/3 | 83 |
| **all** | **Guren** | **15/15** | median 53 | 3191k | | 15/15 | 297 |
| **all** | **Void** | **15/15** | median 33 | 1571k | | 0/15 | 139 |

- **Pass rate:** no difference on Haiku 5.5 either. The weaker model needed
  2–4× Sonnet's tokens on both arms, but made no mistake the suite catches on
  either framework.
- **Token ratio:** Guren used 2.0× Void's input tokens, close to the 2.4× on
  Sonnet. The causes are the same ones listed above.
  - Every Guren cell wrote tests (15/15).
  - Guren cells named `@guren/*` dist paths 225 times in 15 cells; Void cells
    named `void/docs` and `void/dist` 217 times.
  - Rules attached on reads: in the `post-tags` trace one read of
    `routes/web.ts` added 18.5k tokens.
- **Where Guren's verification did something:** the PostToolUse check
  "routes/api.ts exports a route registrar that nothing reachable from
  routes/web.ts calls" fired in all three Haiku json-api-tokens cells (4–5
  times each).
  - Each time, the agent had not yet wired the file.
  - It wired `routes/web.ts` within 1–4 actions after the first block.
  - This is the clearest case in either run of the harness catching a real
    defect, an unmounted API. Without the check, the suite would have failed
    every request with 404, unless the agent caught it some other way.
  - The defect class is Guren's own, though. Void routes are file-based, and
    a file under `routes/api/` is mounted by being there.
- **Cost:** Claude Code 2.1.289 does not know `claude-haiku-5-5`. It warns
  `unrecognized_model` and appears to price the model at Sonnet rates. Its
  per-cell figures (total $48.5 for 30 cells; medians Guren $2.01, Void
  $1.12) overstate the real cost and are not used here. Compare tokens.

## Round 2: same conditions, Guren harness before and after (2026-10-19)

Round 1 mixed the framework with two eval choices that favoured Void. Round 2
removes both and measures a cheaper Guren harness against the old one.

- **Definition of done:** both arms are asked only for a passing typecheck
  (`harness/PREAMBLE.guren.typecheck-only.md` matches the Void preamble but
  for the command). Asking both for tests would have measured setting up a
  test runner in the Void app, which has none. Guren's Stop hook still runs
  the existing tests; that cost is the framework's and stays in.
- **App size:** the Guren page layer is made as lean as the Void app's
  (`harness/lean-pages.py`: no `className`, no whole-line comments;
  `resources/js` 33.7k → 21.5k characters; base `eval/lean-pages` c0a533c in
  agents-on-guren-app). Reference patches were regenerated through the same
  transform (`tasks-guren-lean/`); the fixture gate passed on all five
  tickets. Server code and `.guren/*.gen.ts` are left as the framework
  writes them.
- **Task statements:** checked again; the requirements match, the wording
  differs only where the frameworks do (props vs page data, named actions,
  Void also accepting 400).
- **Arms:** `guren` is the shipped harness of @guren/cli 2.31.1; `guren-v2`
  is the same CLI with the templates of gurenjs `perf/agent-harness-cost`
  (0b717c951) laid over it (`overlays/guren-harness-v2/`): path-scoped rules
  cut to a core with an on-demand reference under the `guren-api` skill,
  `docs-and-spec` only under `docs/**`, a shorter CLAUDE.md, the common test
  mistakes named. The two alternate inside each trial. Void is round 1's 15
  cells: its app, preamble and Claude Code version (2.1.289) are unchanged.

| arm | pass | turns (med) | API calls (med) | context at start | context per call (med) | input tokens (med) | cache write (med) | output (med) | cost (med) | cost (total) | cells that wrote tests | reference reads / cell | node_modules reads / cell | PostToolUse blocks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Guren before | 15/15 | 20 | 12 | 37.0k | 60.5k | 726k | 48k | 8.8k | $0.411 | $6.80 | 4/15 | 0.0 | 1.9 | 32 |
| Guren after | 15/15 | 21 | 12 | 36.1k | 50.4k | 637k | 38k | 9.0k | $0.377 | $5.87 | 2/15 | 0.9 | 2.1 | 30 |
| Void | 15/15 | 19 | 12 | 29.9k | 39.3k | 467k | 23k | 6.9k | $0.254 | $3.85 | 0/15 | 0.0 | 4.5 | 0 |

Per ticket (median cost, turns in run order):

| ticket | Guren before | Guren after | Void |
|---|---|---|---|
| post-tags | $0.44 (20, 29, 20) | $0.38 (19, 20, 17) | $0.22 (15, 10, 13) |
| comments-moderation | $0.44 (29, 27, 26) | $0.43 (40, 29, 27) | $0.30 (24, 24, 19) |
| post-revisions | $0.29 (19, 15, 20) | $0.25 (18, 21, 18) | $0.21 (20, 24, 15) |
| json-api-tokens | $0.79 (41, 44, 29) | $0.52 (33, 35, 25) | $0.27 (17, 23, 15) |
| scheduled-publish | $0.28 (10, 9, 13) | $0.28 (26, 12, 15) | $0.25 (24, 14, 19) |

- **Pass rate:** 45/45. No arm made a mistake the suite catches.
- **Equal conditions alone** move Guren from 2.2× Void's median cost (round
  1) to 1.6×.
- **The v2 harness** cuts the context per call by 17% (60.5k → 50.4k) and
  cache writes by 21%; median cost falls 8% ($0.411 → $0.377), total 14%
  ($6.80 → $5.87). The largest gain is json-api-tokens ($0.79 → $0.52).
  Guren after costs 1.5× Void.
- **What is left:** 6k more context at start (CLAUDE.md, the SessionStart
  map and digest, skill descriptions) and about 11k more per call (the
  framework layers the agent reads: controllers, validators, resources,
  generated manifests). Turns and API calls are now the same in all three
  arms (median 12 calls).
- **Tests:** with no request for them, Guren agents still wrote tests in
  4/15 (before) and 2/15 (after) cells; Void agents in none. The difference
  between 4 and 2 is within noise at n=15.
- **Total spend for round 2:** $12.67 API-equivalent (30 cells).

## Round 3: a defect the ticket never names (2026-10-20)

Rounds 1 and 2 never showed Guren's verification changing an outcome: every
cell passed. Two free steps came first, then a small paid round.

- **Robustness extras.** `suite/tests/extras/*.robustness.test.ts` check what
  the statements ask for but the graded tests skip (invalid input refused,
  guests and other users refused, no 5xx on missing ids, the author not taken
  from the request). Both arms' reference solutions pass them all. All 90
  saved patches of rounds 1 and 2 were re-graded: Void and Guren pass every
  check on Sonnet and on Haiku. The one failure is a round-2 Guren-before
  cell. These tickets are too easy to separate the frameworks this way.
- **A gap in Guren's harness.** `guren audit` flags a mutating action with no
  authorization (rule A01), but only as a warning: `guren gate` passes, and
  the agent never sees it. Harness v4 (gurenjs `perf/agent-harness-cost`,
  7c586bb9e) reports the escalating audit warnings on the files a session
  changed at the Stop hook. In the eval it is overlaid as
  `overlays/guren-harness-v4/` (the hook calls `guren audit --json` itself,
  since @guren/cli 2.31.1 exports no `runAudit`).
- **Hidden-defect tasks** (`tasks/*-authz`, rules in `tasks/_seeds/README.md`):
  the post-tags, post-revisions and scheduled-publish tickets, unchanged,
  over a start state whose post update action lost its author check (one
  line in each app). The defect check (`suite/lib/update-authz.ts`): another
  user's edit is refused and changes nothing. Validated in both apps: the
  reference with the fix passes everything, the reference without it passes
  the graded tests and fails the defect check.

Claude Haiku 5.5, Void vs Guren v4, 3 tickets × 3 trials:

| | Guren v4 | Void |
|---|---|---|
| graded tests pass | 9/9 | 8/9 |
| hidden defect fixed | **9/9** | **6/9** |
| both | **9/9** | **5/9** |
| cost per cell (median, Haiku rates) | $0.058 | $0.037 |
| turns (median) | 49 | 41 |

- **Where the difference is:** post-tags, Guren 3/3 and Void 0/3. In each
  Guren cell the Stop hook reported `PUT /posts/:id: PostController.update …
  neither the middleware chain nor the action body shows an authorization
  check`, and the agent's next edit to `update()` restored
  `this.authorize('update', [Post, post])`. No Void agent touched the check.
- **Where there is none:** post-revisions and scheduled-publish, which both
  arms fixed 3/3. Their statements talk about who may edit, so the agents
  went looking.
- **What favours Guren, by design:** the defect class is one Guren has a
  detector for and Void has none. It is a class either framework can have
  (unlike round 1's unmounted routes file), and the seed is the same one-line
  deletion in both apps, but the round tests whether a shipped detector pays
  off. It does not show that Guren agents are more careful in general.
- **Sample size:** 9 cells per arm, one model, one defect class. Read it as
  "the mechanism works and can decide an outcome", not as a rate.
- **Spend:** $0.81 for the 18 Haiku cells.

### Harness v3 cost (Sonnet 5.5, round-2 conditions)

v3 adds shorter skill descriptions and a shorter CLAUDE.md to v2. It ran
after round 2, not interleaved with it.

| | Guren before | Guren v2 | Guren v3 | Void |
|---|---|---|---|---|
| pass | 15/15 | 15/15 | 15/15 | 15/15 |
| context at start | 37.0k | 36.1k | 34.5k | 29.9k |
| context per call (median) | 60.5k | 50.4k | 48.5k | 39.3k |
| cost per cell (median) | $0.411 | $0.377 | $0.358 | $0.254 |
| cost, 15 cells | $6.80 | $5.87 | $5.88 | $3.85 |

v3's median is 13% under the shipped harness and 1.4× Void. Its total
matches v2 because json-api-tokens cost $0.78 again (v2: $0.52, before:
$0.79), which is within that ticket's spread. Spend: $5.88.

## Round 4: more defect classes, controls, and Sonnet (2026-10-20)

Two more seeds Guren has a detector for, two it was expected not to, and round
3's update-authz tasks on Sonnet 5.5. Seeds, the tickets each rides on, and why
each was chosen: `void-eval/tasks/_seeds/README.md` (written before the cells
ran). Every task passed the same validation as round 3 (the reference with the
fix passes the defect check, without it fails, the graded tests pass both
ways); `post-revisions-mass` failed it on the Void side and was dropped.

| defect | Guren detector | model | arm | defect fixed | graded tests pass | both |
|---|---|---|---|---|---|---|
| delete authorization | yes | haiku-5-5 | Guren v4 | 9/9 | 9/9 | 9/9 |
| delete authorization | yes | haiku-5-5 | Void | 0/9 | 9/9 | 0/9 |
| edit page authorization (GET) | no | haiku-5-5 | Guren v4 | 0/6 | 6/6 | 0/6 |
| edit page authorization (GET) | no | haiku-5-5 | Void | 1/6 | 6/6 | 1/6 |
| mass-assignable authorId | no | haiku-5-5 | Guren v4 | 2/3 | 2/3 | 2/3 |
| mass-assignable authorId | no | haiku-5-5 | Void | 0/3 | 3/3 | 0/3 |
| mass-assignable authorId | no | sonnet-5-5 | Guren v4 | 3/3 | 3/3 | 3/3 |
| mass-assignable authorId | no | sonnet-5-5 | Void | 0/3 | 3/3 | 0/3 |
| update authorization | yes | haiku-5-5 | Guren v4 | 9/9 | 9/9 | 9/9 |
| update authorization | yes | haiku-5-5 | Void | 6/9 | 8/9 | 5/9 |
| update authorization | yes | sonnet-5-5 | Guren v4 | 9/9 | 9/9 | 9/9 |
| update authorization | yes | sonnet-5-5 | Void | 9/9 | 9/9 | 9/9 |

(Rounds 3 and 4 together; "Guren detector" is what the seed table predicted.)

- **Where Guren's audit reads the defect, Guren wins.** Delete authorization:
  9/9 vs 0/9 on Haiku. Update authorization: 9/9 vs 6/9 on Haiku. In each
  winning cell the Stop hook named the action, and the agent's next edit to it
  restored the check.
- **Sonnet 5.5 found the update defect on its own:** 9/9 for both. The hook
  adds nothing for a model that reads the code it changes.
- **The control without a detector shows no Guren advantage.** Edit page
  (GET) authorization: 0/6 vs 1/6. Neither arm's agents look at it, and the
  hook says nothing.
- **Mass assignment was not a clean control.** Guren fixed it 5/6 (Haiku 2/3,
  Sonnet 3/3), Void 0/6. No audit rule reads an `authorId` in `fillable`, but
  the base app's `PostController.store` already carries a "force write fed by
  request data" warning. Harness v4 sends that warning at the Stop hook, and its
  suggestion ("`create(data, { set })`, with authorId removed from fillable and
  from the body schema") led every fixing agent to drop the seeded `authorId`
  too (the stream shows the hook, then the edit, in each case). So this is a
  detector's advice reaching a neighbouring defect, not Guren agents being more
  careful.
- **Cost of the hook:** Guren v4 cells ran more turns (one extra stop each).
  Haiku cost per cell stays a few cents.
- **Spend:** $9.53 for 60 cells (Haiku $1.75 for 36, Sonnet $7.78 for 24).
- **A harness fix during the round:** the mass-assign seed changes a schema,
  so `.guren/*.gen.ts` in a cell's patch (taken after codegen) did not apply to
  the committed start. `verify-cell.sh` and `run-extras-on.sh` now leave
  `.guren/` out of the patch, since setup regenerates it. The six affected
  cells were re-verified (no agent re-run).

**Reading of rounds 3 and 4.** Guren's advantage is real and narrow. It
appears exactly where a shipped check reads the defect and the harness puts
the finding in front of the agent, and it is large there on the weaker model
(18/18 vs 6/18 on the two authorization classes with Haiku). With no detector
the arms match, and a strong model closes the gap on its own.

### Harness v4 cost (Sonnet 5.5, round-2 conditions)

| | Guren v3 | Guren v4 | Void |
|---|---|---|---|
| pass | 15/15 | 15/15 | 15/15 |
| turns (median) | 22 | 28 | 19 |
| context per call (median) | 48.5k | 52.3k | 39.3k |
| cost per cell (median) | $0.358 | $0.430 | $0.254 |
| cost, 15 cells | $5.88 | $6.14 | $3.85 |

v4's Stop hook blocked once in every cell. 13 of the 15 blocks carried the
`PostController.store` force-write warning, which exists only in this eval's
old app (create-guren-app 1.17.2; today's blog template writes
`Post.create(data, { set: { authorId } })`). Six carried policy warnings on
routes the tickets add, and none was a missing check the suite would catch:
`CommentController.store`/`destroy` name `Post` to load the parent post
(comments-moderation), and the API `store` creates a post as the token's owner
(json-api-tokens). So on these tickets v4 costs about 20% more per cell than
v3, mostly for the old app's warning and for the policy rule reading any model
an action names as the record it writes.

## Round 5: v4's cost on today's template (2026-10-23)

The v4 cost above was measured on the old app, whose `PostController.store`
force-write warning blocked 13 of the 15 stops. Round 5 rebuilds the Guren
app from the published release and measures again under round 2's conditions.

- **App:** `bunx create-guren-app@1.19.0 agents-on-guren-app --blueprint blog
  --db sqlite --agents none` (agents-on-guren-app `eval/v2310`, cccdafd). It
  keeps 0fd1654's first migration, since `db/schema.ts` is unchanged. The page
  layer goes through the same `harness/lean-pages.py` (525c19c).
- **Versions:** the base's own lock (`GUREN_UPDATE=none`): @guren/cli 2.32.0,
  core 1.25.0, orm 2.15.0, server 2.31.0.
- **Harness:** what `agent:init` installs from that CLI, with no overlay (arm
  `guren-shipped`). It ships v4's Stop-hook audit escalation, plus template
  changes made since the v4 overlay: a `comments` rule, a `verify-in-browser`
  skill, and subagent definitions.
- **What changed in the app:** `store` writes `Post.create(data, { set: {
  authorId } })`, so the start state has no force-write warning (`guren audit`:
  26 ok, 1 warn, a `katex` dependency advisory, which the hook does not
  escalate). The template also adds login and registration throttling
  (`app/Http/Middleware/AuthThrottle.ts`) and `useId` labels on three forms.
- **References:** `tasks-guren-v2310/`. These are `tasks-guren-lean/` moved onto
  the new base, with three conflicts resolved by hand (`store` in post-tags and
  scheduled-publish, the profile page and `routes/auth.ts` in json-api-tokens).
- **Validation:** before any paid cell, all five tickets failed from the start
  state and passed with the reference, twice each
  (`logs/validate-guren-v2310-2026-10-23.log`). Each reference typechecks.
- **Prompt and Void:** same preamble (typecheck only) and statements. Void is
  round 1's 15 cells.
- **Claude Code:** 2.1.304 here, against 2.1.289 for Void and for every earlier
  Guren arm.
  - 2.1.304's `total_cost_usd` reads about 20% under the token-priced figure
    for the same usage.
  - Every cost in this section, and the v3/v4 rows beside it, is therefore
    priced from tokens (`spend.py` rates; `analyze-round2.py` now does the
    same). For the 2.1.289 rows the two agree within $0.02.

| | Guren v3 | Guren v4, old app | Guren, v2.31.0 app | Void |
|---|---|---|---|---|
| pass | 15/15 | 15/15 | 15/15 | 15/15 |
| turns (median) | 22 | 28 | 24 | 19 |
| API calls (median) | 13 | 17 | 11 | 12 |
| context at start | 34.5k | 22.5k or 34.5k (see below) | 36.6k | 29.9k |
| context per call (median) | 48.5k | 52.3k | 50.6k | 39.3k |
| cost per cell (median) | $0.358 | $0.430 | **$0.347** | $0.254 |
| cost, 15 cells | $5.88 | $6.12 | $6.09 | $3.85 |
| cells the Stop hook blocked | 0/15 | 15/15 | **4/15** | – |

Per ticket (median cost, turns in run order):

| ticket | Guren v4, old app | Guren, v2.31.0 app | Void |
|---|---|---|---|
| post-tags | $0.43 (25, 36, 28) | $0.43 (24, 17, 40) | $0.22 (15, 10, 13) |
| comments-moderation | $0.46 (37, 37, 38) | $0.35 (37, 29, 29) | $0.30 (24, 24, 19) |
| post-revisions | $0.23 (21, 20, 23) | $0.27 (22, 17, 22) | $0.21 (20, 24, 15) |
| json-api-tokens | $0.63 (46, 40, 41) | $0.66 (41, 43, 37) | $0.27 (17, 23, 15) |
| scheduled-publish | $0.27 (12, 17, 13) | $0.25 (8, 15, 12) | $0.25 (24, 14, 19) |

Why the Stop hook blocked (`harness/stop-blocks.py <dir> <arm> --cells`;
findings counted once per cell):

| finding | v4, old app | v2.31.0 app |
|---|---|---|
| force write: `PostController.store` (old template) | 12 cells | 0 |
| force write: `PostController.update`, `ApiPostController.store` | 3 cells | 0 |
| missing authorization: `ApiPostController.store` (json-api-tokens) | 3 cells | 3 cells |
| missing authorization: `CommentController.store`/`destroy`/`report` | 3 cells | 1 cell |

- **Fewer blocks, lower median.** The hook blocked 4 cells instead of 15, and
  the median cell fell from $0.430 to $0.347, level with v3 ($0.358). Median
  API calls fell from 17 to 11, below v3's 13.
  - Three things changed at once: the app template, the harness templates
    (the shipped set is not the v4 overlay) and Claude Code (2.1.289 →
    2.1.304).
  - So the drop cannot be credited to the missing warning alone.
- **The total did not fall** ($6.09 vs $6.12). json-api-tokens costs as much as
  before ($0.66), and post-tags trial 3 ran 40 turns. At n=3 a single long
  cell moves a ticket's total more than the hook does.
- **The four blocks:**
  - json-api-tokens, all 3 cells. The token's owner creates a post through
    `POST /api/posts`, and the policy rule reads `Post` as the record being
    written. Two agents recorded a `guren-audit-ignore` with the reason. One
    made the controller resolve the token's owner as the gate user. The suite
    would not have failed any of them, so for this ticket the warning is a
    false positive.
  - comments-moderation, 1 cell. The agent added
    `this.authorize('create', Comment)` to `store`. That hardens the action,
    but the suite does not check it.
- **Against Void:** 1.37× the median ($0.347 vs $0.254) and 1.58× the total,
  across Claude Code versions (Void's cells ran on 2.1.289).
  json-api-tokens accounts for most of the total gap. The per-call context gap
  (50.6k vs 39.3k) is the same as in round 2.
- **Start context of the old v4 cells is bimodal.** 9 of the 15 began at about
  22k tokens and 6 at about 34.5k. In both kinds the SessionStart hook returned
  the same 11k characters. We did not trace the cause, so the table gives both
  values. Every v3 and round-5 cell began within 0.4k of its arm's median.
- **Spend:** $6.09 for 15 cells (estimate about $6, cap $10). Claude Code's own
  `total_cost_usd` for the same cells sums to $4.97.

## Pilot (round-1 bug tasks, for the record)

Four round-1 tasks, 1 trial each (missing-authorize-destroy,
pagination-skips-page, raw-body-no-validation, api-posts-contract): 8/8 pass.

- **Too easy to separate the arms:** the bug fixes took 5–9 turns and
  similar tokens on both arms.
- **First Guren pass ran a stale harness:** it used 0fd1654's locked CLI
  2.27.0, whose rules use the ignored `globs:` key, so all rules loaded at
  start: 53.8k tokens of start context.
- **Rerun on 2.31.1:** the Guren cells were rerun on the current CLI; the
  old pass is kept in `void-eval/results-guren-cli227/`.
- **Tables:** `void-eval/results/RESULTS.md`, which covers every cell.

## Findings about Void

- `npx void init` in an empty directory links `.claude/skills/*` to the npx
  cache (`~/.npm/_npx/<hash>/…`), not to `node_modules/void/skills`. The links
  dangle after a cache purge or on another machine.
- The README's flow (`npm init -y && npm i -D void && npx void init`) fails:
  - `vp install` stops with an npm `Cannot read properties of null` error;
  - the `"type": "commonjs"` package cannot load `vite.config.ts`.
- Named page actions redirect with the action suffix kept:
  `c.redirect('/posts/2')` from `?update` answers `Location: /posts/2?update`.
- Validation failures never answer 422:
  - page actions answer 200 with `errors` in the page data;
  - route validators answer 400.
- `InferProps` of a loader built with `defineHandler.withValidator({ query })`
  is a `Promise<…>`, so the page's props do not typecheck.
- Problems seen under `vp dev`:
  - It sometimes stalls on a cold start in the dependency optimizer.
  - Two dev servers collide on the inspector port.
  - After a handler answers without reading the request body, the next
    request sometimes gets Vite's own "fetch failed" page.

  The suite works around all three. It retries the boot, runs Void servers
  one at a time, and retries that exact page once.
- Claude Code loads `AGENTS.md`, so Void's pointer to its docs is in context.
  Void agents named `node_modules/void/docs` paths 84 times in 15 cells,
  about 5–6 per cell, and `void/dist` 20 times. Guren agents named
  `@guren/*` dist paths 47 times, 30 of them on json-api-tokens. No agent
  invoked the `void` skill.

## Where Guren could do better (proposals for gurenjs)

Ordered by effect in this round. Items 1–5 rest on measurements; items 6
and 7 are judgement.

1. **Document the API-token and rate-limit story where the agent looks.**
   json-api-tokens cost 4.5× Void's tokens, and the agents spent it grepping
   `@guren/server` dist for `createApiToken`, `createRateLimitMiddleware` and
   CSRF options. The fix: a short section in `rules/controllers-http.md` or
   the `guren-api` skill covering:
   - issuing and storing a token;
   - the bearer middleware;
   - `createRateLimitMiddleware` with per-token keys and `Retry-After`;
   - excluding bearer routes from CSRF.

   More generally, `guren check` could log which `@guren/*` dist files agents
   open (in eval mode) to find more gaps of this kind.
2. **Make path-scoped rules cheaper.** Reading one controller or model adds
   about 7–8k tokens of rules that stay for the rest of the session
   (measured above). A feature ticket ends up with most of the six attached.
   Ideas:
   - split each rule into a short always-true core and a reference section
     the agent reads on demand;
   - narrow the `paths:` globs, for example `testing.md` only for `tests/**`
     and not every `*.ts`;
   - check for overlap with CLAUDE.md and the SessionStart context.
3. **Stop blocking on mid-edit states in PostToolUse.** There were 33 blocks
   in 15 cells. Most were a route graph that cannot load yet, or unused
   imports in a half-written file. Keep the blocks that catch real defects,
   such as the unmounted-routes check, which found the one real defect in
   this round. Options for the rest:
   - report "route graph failed to load: X is not defined" as non-blocking
     context, and leave it to the Stop gate, which runs on the finished
     change;
   - drop oxlint warnings (not errors) from the blocking set.
4. **Decide what the tests are for, and make them earn their cost.** Guren
   agents wrote tests in 11/15 cells, which roughly doubled tokens on those
   tickets. No test changed an outcome. Part of the cause is this eval's
   prompt, which asks for passing tests only on Guren. A fairer next round
   should either ask both arms for tests or neither. Two options for
   Guren:
   - **keep them as a deliverable**, and say so in the report and the
     product pitch: "Guren agents leave tests behind; Void agents do not";
   - **make them cheaper**, for example a test-scaffold command that writes
     the boilerplate (`TestApp`, `actingAs`, CSRF) so the agent writes only
     the cases. `rules/testing.md` is 9k characters today.
5. **Trim session start.** With CLI 2.31.1, Guren's start context is 7k
   tokens over Void's (35.6k vs 28.4k). With 2.27 it was 25k over. Ideas:
   - have `guren upgrade --check-only` / `agent:sync` flag a pre-2.28 harness;
   - load the 8k-character SessionStart "Project Context" on demand;
   - drop skills a blog does not use (`github-projects`, `plugin-authoring`,
     `ai-agent`).
6. **Offer a lean blueprint.** The blog blueprint's pages carry 10k
   characters of Tailwind classes and about 7k of comments, and the agents
   read them. A `--minimal` blueprint, or terser pages, would cut the cost
   of every task in a new app. It would also let a later round separate app
   size from framework cost.
7. **Find tickets where verification pays.** On both Sonnet 5.5 and Haiku
   5.5 every cell passed, so the extra verification bought no pass-rate
   difference. Only the unmounted-routes check did visible work, and only
   against a defect class Guren's own routing creates. Two ways to look:
   - harder tickets, more subsystems, longer specs;
   - a mutation-style round that seeds subtle defects the agent must find,
     where an agent that runs tests should have an edge.

## Reproduce

```bash
cd void-eval
# fixture gate (both apps; the start state must fail, the reference must pass)
SUITE_PORT=4100 bash suite/validate-guren.sh post-tags comments-moderation post-revisions json-api-tokens scheduled-publish
SUITE_PORT=4200 bash suite/validate-void.sh  post-tags comments-moderation post-revisions json-api-tokens scheduled-publish
# the matrix (trial-outermost, resumable, verifies after each cell)
SUITE_PORT=4300 bash harness/run-matrix.sh --tasks post-tags,comments-moderation,post-revisions,json-api-tokens,scheduled-publish \
  --arms guren,void --models claude-sonnet-5-5 --trials 3
python3 harness/summarize.py --out results/RESULTS.md      # per-cell verdicts and verification columns
python3 harness/analyze.py > results/ANALYSIS-STAGE2.md    # the tables in this report (needs the streams)
bash harness/probe-context.sh guren README.md app/Http/Controllers/PostController.ts app/Models/Post.ts
bash harness/probe-context.sh void                         # start context only
```

Requirements:

- `claude` logged in
- mise with node 24.22.0
- pnpm, bun and sqlite3
- `agents-on-guren` and `agents-on-guren-app` checked out next to this
  repository (or `AOG_ROOT` and `GUREN_APP_REPO` pointing at them)

`results/<ticket>/<arm>-<model>-<trial>.*` holds per cell:

- `patch`, `result.json`, `meta.json`
- `verdict.json`, `suite.log`, `typecheck.log`

Event streams (`*.stream.jsonl`) are gitignored and not published: they
carry full prompts, local paths and session data. The tables they feed are
committed (`results/ANALYSIS-STAGE2*.md`, and this report). `analyze.py`,
`analyze-round2.py` and `stop-blocks.py` need the streams of a run of your
own. Saved `result.json` and `meta.json` files pass through
`harness/sanitize-results.py`, which keeps token usage, turns and the final
message and drops session ids, timings and local paths.
