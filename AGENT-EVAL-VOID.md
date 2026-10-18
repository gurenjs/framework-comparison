# Agent eval: Guren (with its harness) vs Void

**Status: pilot only (8 cells, one model, one trial).** The numbers below
cannot support a claim either way. They establish that the setup works, how
much a full run costs, and what the full run must change to measure anything.
The full run has not been done.

## Question

Guren's main pitch for agents is that they can write the app and that the
result is checked: `guren check`/`gate`, typecheck, and browser verification,
which the shipped harness runs from hooks. The existing numbers (Sonnet 5 60/60, cost −25%)
compare Guren with its harness against Guren without it. Void (VoidZero /
Cloudflare: Vite + Hono + Drizzle, docs bundled in `node_modules/void/docs`,
an `AGENTS.md` and two skills from `void init`) is the first competitor built
on the same idea. Is there evidence that agents do better on Guren than on
Void?

## Setup

| | Guren arm | Void arm |
|---|---|---|
| App | `agents-on-guren-app` at 0fd1654 (create-guren-app 1.17.2, @guren/cli 2.27) | `void-eval/app`: the same blog written by us on Void 1.1.11 |
| Scaffold | `create-guren-app --blueprint blog --db sqlite` | `npx void@1.1.11 init`: Vite+, React, D1 (SQLite), no deployment target |
| Agent guidance | `bunx guren agent:init --target claude`: CLAUDE.md, `.claude/rules`, 10 skills, SessionStart/PostToolUse/Stop hooks | what `void init` installs: a 2-line `AGENTS.md` pointing at `node_modules/void/docs/`, and `.claude/skills/{void,migrate-vite-cloudflare-to-void}` |
| Prompt | agents-on-guren `PREAMBLE.md` + the task statement | the same preamble with "`pnpm typecheck` passes" as the definition of done (the Void app has no test suite, because Void documents no testing story for apps) + the statement adapted to the Void app's URLs |
| Pass gate | black-box suite green **and** `bunx tsc --noEmit` | black-box suite green **and** `pnpm typecheck` (`void prepare && tsc --noEmit`) |

Both arms use the same runner: headless Claude Code 2.1.289, `--max-turns 120`,
`--strict-mcp-config`, `--setting-sources project,local`, auto memory off, and
no WebFetch/WebSearch. The Bash allowlist is the union of what either framework
tells an agent to run (bun/bunx, pnpm, npx, vp, …). `void deploy`, `connect`,
`login`, `secret`, `platform` and `project` are denied under every runner
spelling.

### The Void app

There is no third-party Void blog to compare against, so the Void app was
written for this eval. It mirrors the Guren app route for route:

- `/posts` (newest first, 10 per page, the same pagination meta names, keyword search)
- `/posts/:id`, `/posts/create`, `/posts/:id/edit`
- `/profile`, `/dashboard`, `/login`, `/register`, `/health`

It is written the way the Void docs show:

- pages with `.server.ts` loaders and actions
- `withValidator` with zod
- named actions `?update` / `?delete` for the post page
- Void-managed Better Auth (`/api/auth/*`)
- Drizzle via `void/db`
- `requireAuth` / `HTTPException`

Authorship is a bias risk: the Void app's quality is our work, not
VoidZero's.

### Tasks

Four of the 20 round-1 agents-on-guren tasks, picked because a black-box
HTTP test can decide them the same way on both apps, and because their Guren
seed and reference patches apply to 0fd1654 unchanged:

| task | kind | Void adaptation |
|---|---|---|
| missing-authorize-destroy | sec, E | `DELETE /posts/:id?delete`; no CSRF wording |
| pagination-skips-page | bug, E | none |
| raw-body-no-validation | sec, E | no password field or `passwordHash` (Better Auth keeps the hash in `account`); the extra field is `id`/`emailVerified` |
| api-posts-contract | feat, M | author ids are strings; invalid `page` → 400 **or** 422 (Void route validators always answer 400); "typed surface" means Void's typed fetch |

Each Void seed (`tasks/<id>/seed.void.patch`) injects the same defect as the
Guren seed. The reference fixes it (`reference.void.patch`).

The remaining 16 tasks:

- 9 are equally portable: mass-assignment-author, open-redirect-login,
  rate-limit-login, auto-excerpt, dashboard-stats, health-db-probe,
  post-slug-binding, published-flag, search-orwhere-leak.
- 2 need Void-specific versions:
  - welcome-mail-job: Void email/queues.
  - i18n-ja-catalog: there is no `lang/` catalog.
- 5 test Guren's own machinery and are out: unmounted-routes-file,
  route-wildcard-404, put-redirect-302, resource-drops-excerpt,
  typed-form-register.
- rate-limit-login's meaning shifts on Void, because Better Auth already
  rate-limits sign-in on deployed Workers.

### Grading: one suite, two drivers

The agents-on-guren hidden tests run in-process against `@guren/testing`, so
they cannot grade Void. `void-eval/suite/` is a black-box HTTP suite instead:

- It boots the app on a fresh, empty database.
- It registers users, signs in, and acts over real HTTP.
- It asserts on statuses and on page data.

The test files are identical for both apps. Framework specifics live in
`drivers/guren.ts` and `drivers/void.ts`:

- Guren: CSRF, Inertia JSON.
- Void: the `Origin` header, `X-VoidPages` page JSON, named actions.

A validation failure counts as "rejected with field errors" in each
framework's own shape:

- Guren: 422 JSON.
- Void: 200 page JSON whose `errors` field is set.

Validation gate: on both apps, the seeded start state must fail and the
reference must pass, twice each.

| task | Guren seeded / reference | Void seeded / reference |
|---|---|---|
| missing-authorize-destroy | fail ×2 / pass ×2 | fail ×2 / pass ×2 |
| pagination-skips-page | fail ×2 / pass ×2 | fail ×2 / pass ×2 |
| raw-body-no-validation | fail ×2 / pass ×2 | fail ×2 / pass ×2 |
| api-posts-contract | fail ×2 / pass ×2 | fail ×2 / pass ×2 |

## Pilot results (Sonnet 5.5, 1 trial, 2026-10-18)

The Guren arm runs on the current releases: `bun update` in the start state
gives @guren/cli 2.31.1, then `agent:init`. A first pass on 0fd1654's locked
CLI 2.27.0 is kept in `void-eval/results-guren-cli227/`. That CLI's rules use
the `globs:` key, which Claude Code ignores (fixed in 2.28), so all rules
loaded at session start. Its Guren cells cost about 2× the Void cells. That
gap was a fixed bug, not Guren today.

| model | arm | cells | pass | med turns | med cost (USD) | total cost (USD) | typecheck after last edit | ran typecheck at all | ran tests | guren gate CLI | stop-hook runs / blocks | Void docs reads (med) | Skill uses | denials |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | guren | 4 | 4/4 | 6.5 | 0.14 | 0.74 | 2/4 | 4/4 | 4/4 | 0/4 | 4 / 0 | 0.0 | 0 | 1 |
| claude-sonnet-5-5 | void | 4 | 4/4 | 7.5 | 0.09 | 0.35 | 4/4 | 4/4 | 0/4 | 0/4 | 0 / 0 | 0.0 | 0 | 1 |

Per cell:

| task | arm | model | trial | status | typecheck | suite | turns | cost | tc runs | tc after last edit | tests | gate | stop runs/blocks | docs reads | skills | denials |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| api-posts-contract | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (8 pass  0 fail) | 19 | 0.339 | 1 | False | 3 | 0 | 1/0 | 0 | 0 | 1 |
| api-posts-contract | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (8 pass  0 fail) | 6 | 0.107 | 2 | True | 0 | 0 | 0/0 | 2 | 0 | 1 |
| missing-authorize-destroy | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (3 pass  0 fail) | 5 | 0.129 | 1 | True | 1 | 0 | 1/0 | 0 | 0 | 0 |
| missing-authorize-destroy | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (3 pass  0 fail) | 6 | 0.066 | 1 | True | 0 | 0 | 0/0 | 0 | 0 | 0 |
| pagination-skips-page | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 6 | 0.139 | 2 | True | 2 | 0 | 1/0 | 0 | 0 | 0 |
| pagination-skips-page | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 9 | 0.083 | 1 | True | 0 | 0 | 0/0 | 0 | 0 | 0 |
| raw-body-no-validation | guren | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 7 | 0.133 | 1 | False | 1 | 0 | 1/0 | 0 | 0 | 0 |
| raw-body-no-validation | void | claude-sonnet-5-5 | 1 | PASS | pass | pass (6 pass  0 fail) | 9 | 0.094 | 2 | True | 0 | 0 | 0/0 | 0 | 0 | 0 |

Session-start context, measured with a one-turn "reply OK" session in each
start state (input + cache-write + cache-read tokens). The order of the arms
did not change these numbers.

| start state | tokens |
|---|---|
| Void (`AGENTS.md` + 2 skills) | 28.4k |
| Guren, @guren/cli 2.31.1 harness | 35.6k |
| Guren, @guren/cli 2.27.0 harness | 53.8k |

Tokens per cell (all input tokens processed, plus output). Dollar costs above
depend on which cell wrote the shared prompt cache first, so they are not
comparable across arms. These are:

| task | Guren turns / input / output | Void turns / input / output |
|---|---|---|
| missing-authorize-destroy | 5 / 159k / 0.7k | 6 / 148k / 0.7k |
| pagination-skips-page | 6 / 239k / 0.8k | 9 / 183k / 1.2k |
| raw-body-no-validation | 7 / 236k / 1.3k | 9 / 244k / 1.2k |
| api-posts-contract | 19 / 686k / 4.0k | 6 / 169k / 2.1k |

What this shows:

- **Every cell passes.** These four tasks are too easy to separate the two
  frameworks. Success rate will not discriminate on round-1 tasks. A full
  run needs harder tasks: the Stage 2 tickets (three or more subsystems,
  where Sonnet 5.5 bare was 96% and Haiku 30–44% on Guren) ported to Void,
  or a weaker model such as Haiku 4.5.
- **On the three bug fixes the work is about the same.**
  - Each arm took 5–9 turns and processed 150–245k input tokens.
  - Guren starts with 7k more tokens of context and takes slightly fewer
    turns.
  - No efficiency claim either way follows from n=1.
- **The API feature is where the arms differ, and the tasks are not equal
  there.**
  - The Guren statement asks for a named route `api.posts.index` in the
    generated client with a declared `resource` response type. Its agent read
    `@guren/server` route types, hit a `guren check` PostToolUse block
    ("route graph failed to load") and fixed it.
  - It also added an `api.posts.index` test to `tests/PostController.test.ts`
    and ran it, plus a throwaway probe test. That took 19 turns, 4× Void's
    tokens.
  - The Void agent `grep`ped two bundled guides, wrote one route file,
    typechecked, and stopped after 6 turns. It never exercised the endpoint.
  - Both pass the black-box suite. The extra Guren work is the "verified, not
    just written" behaviour the pitch is about, but n=1. It is driven partly
    by the stricter Guren statement and partly by the presence of an
    existing test suite and a `bun test` line in the definition of done.
- **Verification behaviour.**
  - All 8 cells ran a typecheck. The last run came after the final edit in
    4/4 Void cells and 2/4 Guren cells. In the other two Guren cells the agent
    edited once more after checking, and the Stop-hook gate ran and passed
    them.
  - Guren cells also ran `bun test` (4/4), and one wrote a new test. Void
    has no test suite to run.
  - No Guren agent called `guren check`/`gate` itself. The checks came from
    hooks.
- **Void's guidance was barely needed.**
  - Claude Code does load `AGENTS.md` (checked with a no-tool probe in the
    Void start state), so Void's pointer to `node_modules/void/docs/` is in
    context.
  - No agent invoked the `void` skill.
  - Only the API cell touched the bundled docs, and two `grep`s were
    enough. A model that knows Hono, Drizzle and React needed nothing
    Void-specific for these tasks.

## Findings about Void along the way

- `npx void init` in an empty directory links `.claude/skills/*` to the
  **npx cache** (`~/.npm/_npx/<hash>/…`), not to `node_modules/void/skills`.
  On another machine or after a cache purge the links dangle. We relinked
  them to `node_modules`.
- `npm init -y && npm i -D void && npx void init` (the README's flow) fails
  at `vp install` with an npm `Cannot read properties of null` error, and
  the resulting `"type": "commonjs"` package cannot load `vite.config.ts`.
  The empty-directory flow (pnpm) works.
- Named page actions redirect with the action suffix still on the URL:
  `c.redirect('/posts/2')` from `?update` answers `Location: /posts/2?update`.
- Page-action validation failures answer **200** with `errors` in the page
  data, while route validators answer **400**. Neither answers 422.
- `InferProps` of a loader built with `defineHandler.withValidator({ query })`
  is a `Promise<…>`, so the page component's props do not typecheck. We used
  `safeParse(c.req.query())` instead.
- `vp dev` sometimes stalls on a cold start in Vite's dependency optimizer.
  Two Void dev servers at once also collide on the inspector port (9229). The
  suite retries the boot up to 3 times and runs Void servers one at a time.

## Runner notes

- Claude Code 2.1.289 ignores `permissions.allow` in an untrusted workspace's
  `.claude/settings.json`, which affects agent:init's 5 allow entries. Hooks
  still run. The CLI allowlist covers the same commands, so cells were not
  affected. Earlier rounds ran with those entries active.
- Built-in Claude Code skills (deep-research, design, …) are listed in both
  arms alike.
- The Guren side of the suite gate was validated on 0fd1654's locked
  dependencies. The Guren cells run after `bun update`. All four of them
  passed the suite, but the gate itself was not rerun on the updated
  dependencies. Rerun `suite/validate-guren.sh` with the update before a
  full run.
- `run-matrix.sh` runs the arms in a fixed order per task (Guren first), so
  whichever cell writes the shared prompt cache first pays for it. For a
  full run, alternate the order and compare token totals, not dollars.

## Cost of a full run (estimate)

| scope | cells | API-equivalent |
|---|---|---|
| these 4 tasks × 2 arms × 3 trials, Sonnet 5.5 | 24 | about $4 |
| 13 portable round-1 tasks × 2 × 3, Sonnet 5.5 | 78 | about $15 |
| the same plus Opus 5.5 and Haiku 4.5 | 234 | about $60–80 |
| Stage 2 tickets (needs Void ports of 4–6 tickets) × 2 × 3, Sonnet 5.5 | 24–36 | about $25–40 |

Wall time is about 3–5 min per cell including grading, run one at a time
because of the Void dev-server limit. 78 cells take about 5–6 h.

The bigger cost is fixture work. Each additional task needs a Void seed and
reference, an adapted statement, and suite cases on both drivers. That took
about 1 h per easy task in this pilot. A Stage 2 ticket will take longer:
plan fixtures, more subsystems.

## Where Guren could do better (proposals for gurenjs)

1. **Keep the session-start budget in check.** With CLI 2.31.1, Guren's start
   context is 7k tokens over Void's (35.6k vs 28.4k). With 2.27 it was 25k
   over. Any app still on a pre-2.28 harness pays the 25k, so
   `guren upgrade --check-only` / `agent:sync` should flag an outdated agent
   harness. Further trims:
   - load the 8k-character SessionStart "Project Context" on demand;
   - drop skills a blog does not use (`github-projects`, `plugin-authoring`,
     `ai-agent`).
2. **Make verification visible in the outcome, not only in hooks.** The
   pitch is "the result is checked", but on these tasks the agent's own
   behaviour was the same as on Void: typecheck, then stop. A Stop gate that
   ran and passed is invisible to the user. Two options:
   - have the gate print a short "verified: typecheck, routes, policy
     coverage" line into the final message;
   - have it exercise the changed route (an HTTP probe or a generated test
     for the touched policy) when one changed.
3. **A test story for the definition of done.** Guren's preamble has
   `bun test` because the app ships tests, and Void has none. On a harder task
   that is a real advantage, but only if agents add tests. Measure "agent
   added a test" in the full run.

## Reproduce

```bash
cd void-eval
bash harness/run-matrix.sh --tasks missing-authorize-destroy,pagination-skips-page,raw-body-no-validation,api-posts-contract \
  --arms guren,void --models claude-sonnet-5-5 --trials 1
python3 harness/summarize.py --out results/RESULTS.md
suite/validate-guren.sh && suite/validate-void.sh   # the fixture gate
```

Requirements:

- `claude` logged in
- mise with node 24.22.0
- pnpm and bun
- `~/Development/agents-on-guren` and `~/Development/agents-on-guren-app`
  checked out

`results/` holds per cell: `*.stream.jsonl`, `*.result.json`, `*.patch`,
`*.meta.json`, `*.verdict.json`, `*.suite.log`, `*.typecheck.log`.
