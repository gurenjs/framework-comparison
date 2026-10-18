# Agent eval: Guren (with its harness) vs Void

**Result (Sonnet 5.5, 5 Stage 2 tickets × 2 arms × 3 trials, 2026-10-18):
both arms pass 15/15.** On the same tickets, Guren cells used 2.4× the input
tokens and 2.1× the dollars of Void cells (medians 1.12M vs 0.47M tokens,
$0.55 vs $0.25). They also took more turns (23 vs 19). This sample shows no
evidence that agents do better on Guren than on Void. It does show where
Guren's extra cost goes, which is the basis for the proposals at the end.

Read the caveats before quoting a number:

- one model;
- n=3 per cell;
- a Void app written by us, about a third the size of the Guren app;
- five tickets.

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
| App | `agents-on-guren-app` at 0fd1654 (create-guren-app 1.17.2), then `bun update` to the current releases (@guren/cli 2.31.1) | `void-eval/app`: the same blog, written by us on Void 1.1.11 |
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
- Void reference: `reference.void.patch`, written by the porting agents.

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

### The work done was equal

- **UI:** both arms changed the same number of UI files on every ticket, so
  neither arm skipped the forms.
- **Size of the change:** the median patch adds 511 lines on Guren and 613 on
  Void. The Void cells did the same work for half the tokens.

### Where Guren's extra tokens go

The gap is mostly context per turn, not turns: about 49k input tokens per
turn on Guren against 25k on Void. Reading the cells' event streams (scripts
under `void-eval/harness/`), it breaks down like this:

1. **Session start: +7k tokens.** A one-turn probe in each start state
   measured 35.6k on Guren (CLAUDE.md, SessionStart "Project Context", 10
   skill descriptions) and 28.4k on Void. Every turn carries it.
2. **Path-scoped rules that attach mid-session: up to +11k.** The six rules
   total 43k characters (`controllers-http` 10k, `orm-models` 10k, `testing`
   9k, …). A ticket that reads controllers, models, routes and tests ends
   with all of them attached.
   - In the `post-tags` trace, a single `cat` of four Guren files added 15.5k
     tokens. On Void the largest single jump was 6k.
3. **A bigger app to read.** Guren cells' file reads and `cat`s returned
   about 13k characters per cell; Void cells' returned 2k. This is mostly
   the confound above.
4. **Tests the agents wrote.** Guren agents added tests in 11/15 cells and
   ran `bun test` in 15/15. Void agents wrote none: the app has no test
   runner, and the Void docs describe no testing story for apps.
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

   The agent's next action after a block was almost always the edit it had
   planned anyway. These blocks cost context and caught nothing a later
   check would have missed.

### Verification: done, but no visible effect on the outcome

- **Tests:** in no Guren cell did a failing `bun test` lead to a source
  change (0/15). The tests the agents wrote passed on the first run, or
  failed for reasons inside the test itself.
- **The gate:** the Stop-hook gate ran in all 15 Guren cells and blocked 0.
- **Booting the app:** no agent in either arm started the app to check its
  work.
- **Typecheck:** every cell in both arms ran it.

On Sonnet 5.5 and these tickets, Guren's extra verification bought no
difference in pass rate. The black-box suite passed Void's unverified
patches just as often. The verification pitch may still pay where models make
more mistakes. In agents-on-guren Stage 2, Haiku 4.5 moved from 30% bare to
44% shipped. A Haiku run of this comparison is the experiment that could show
it.

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
  Agents used the docs sparingly: 2 reads per cell (median), plus about 4
  framework-file reads. No agent invoked the `void` skill.

## Where Guren could do better (proposals for gurenjs)

Ordered by measured effect in this round:

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
2. **Make path-scoped rules cheaper.** Six rules at 43k characters can add
   about 11k tokens to every later turn of a feature ticket. Ideas:
   - split each rule into a short always-true core and a reference section
     the agent reads on demand;
   - narrow the `paths:` globs, for example `testing.md` only for `tests/**`
     and not every `*.ts`;
   - check for overlap with CLAUDE.md and the SessionStart context.
3. **Stop blocking on mid-edit states in PostToolUse.** 33 blocks in 15
   cells, mostly a route graph that cannot load yet or unused imports in a
   half-written file. Options:
   - report "route graph failed to load: X is not defined" as non-blocking
     context, and leave it to the Stop gate, which runs on the finished
     change;
   - drop oxlint warnings (not errors) from the blocking set.
4. **Decide what the tests are for, and make them earn their cost.** Guren
   agents wrote tests in 11/15 cells, which roughly doubled tokens on those
   tickets. No test changed an outcome. Two options:
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
7. **Run the comparison on Haiku 4.5.** If Guren's verification is worth its
   cost anywhere, it should show on a model that makes mistakes. This round
   cannot show it, because Sonnet 5.5 made none that the suite catches.

## Reproduce

```bash
cd void-eval
# fixture gate (both apps; seeded/start must fail, reference must pass)
SUITE_PORT=4100 bash suite/validate-guren.sh post-tags comments-moderation post-revisions json-api-tokens scheduled-publish
SUITE_PORT=4200 bash suite/validate-void.sh  post-tags comments-moderation post-revisions json-api-tokens scheduled-publish
# the matrix (trial-outermost, resumable, verifies after each cell)
SUITE_PORT=4300 bash harness/run-matrix.sh --tasks post-tags,comments-moderation,post-revisions,json-api-tokens,scheduled-publish \
  --arms guren,void --models claude-sonnet-5-5 --trials 3
python3 harness/summarize.py --out results/RESULTS.md
```

Requirements:

- `claude` logged in
- mise with node 24.22.0
- pnpm, bun and sqlite3
- `~/Development/agents-on-guren` and `~/Development/agents-on-guren-app`
  checked out

`results/<ticket>/<arm>-<model>-<trial>.*` holds per cell:

- `patch`, `result.json`, `meta.json`
- `verdict.json`, `suite.log`, `typecheck.log`

Event streams (`*.stream.jsonl`) are gitignored. Attach them to a release if
the PR is merged.
