# Brief: port one agents-on-guren Stage 2 ticket to the Guren-vs-Void eval

You port **one** Stage 2 ticket (named in your prompt as `<id>`) so that the
same black-box acceptance test can grade an AI agent's work on two apps:

- the Guren blog app `agents-on-guren-app`, commit 0fd1654, after `bun update`
- the Void blog app `void-eval/app`, written on Void 1.1.11

Work only in `~/Development/framework-comparison-void-eval/void-eval`,
and only in the files listed under "What you own". Do not commit, push, or edit
any other file. That includes `suite/drivers/{types,guren,void}.ts`,
`suite/lib/*`, `suite/run.sh`, `suite/boot-*.sh`, `harness/*` and `app/*`.
Other agents are porting other tickets in parallel. If you need a change in a
shared file, stop and report it.

## Read first

- `~/Development/agents-on-guren/CORPUS-STAGE2.md`, the section for
  your ticket.
- `~/Development/agents-on-guren/tasks/<id>/`:
  - `statement.md`
  - `hidden/*.ts`: the in-process tests to port
  - `reference.patch`: the Guren solution
  - `task.json`
- `suite/README.md`: the driver contract, how to run, and how the round-1
  tests were ported.
- `suite/drivers/types.ts`: the full driver interface, including `mutate`,
  `page` and `sql`.
- Examples: `suite/tests/*.test.ts` and `tasks/raw-body-no-validation/` for a
  Void statement adaptation.
- The Void app `app/`: pages with `.server.ts` loaders and actions, named
  actions `?update` / `?delete` on `pages/posts/[id].server.ts`, Better Auth
  users in the `user` table with string ids (`lib/users.ts`),
  `lib/validators.ts`. Void docs are in `app/node_modules/void/docs/`.
  `app/node_modules` exists; never edit it.

## What you own (create these)

1. `tasks/<id>/task.json`:
   `{"stage": 2, "source": "agents-on-guren/tasks/<id>", "max_turns": 200}`.
2. `tasks/<id>/statement.guren.md`: a verbatim copy of the agents-on-guren
   `statement.md`. Change it only if your prompt says to.
3. `tasks/<id>/statement.void.md`: the same ticket for the Void app.
   - Keep the product text, the pinned contract (table and column names, field
     names, status codes, JSON shapes) and the acceptance list identical in
     meaning.
   - Change only what has to differ on Void:
     - URLs of named actions (`PUT /posts/:id?update`, `DELETE /posts/:id?delete`)
     - "the `post` prop" becomes "the post page's data (`post`)"
     - Inertia, CSRF and `bun run …` wording
     - user ids are strings
     - validation errors come back in the page data's `errors` (200), not as
       422, for page actions; JSON routes use 400 or 422
   - Never name the Void API, file or CLI that solves the ticket. The Guren
     statement doesn't name Guren's either.
   - Write down every change and why in `tasks/<id>/PORTING.md`.
4. `tasks/<id>/reference.void.patch`: a working Void solution, written the
   way the Void docs recommend, as `git diff` relative to the app root (paths
   like `a/pages/...`, not `a/void-eval/app/...`).
   - Build it in a standalone copy. Running
     `bash -c 'source harness/lib.sh; make_start_state void <id> $WT_ROOT/port-<id>; setup_app void $WT_ROOT/port-<id>'`
     gives you a committed git repo, so `git diff` there produces the patch.
   - It must pass `pnpm typecheck` (`void prepare && tsc --noEmit`). If the
     schema changes, run `npx void db generate` in the copy and include the
     migration in the patch.
5. `suite/tests/<id>.test.ts`: the port of the hidden tests.
   - Same cases, same expectations, written against the `Driver` only.
   - It must be identical for both frameworks.
   - Framework differences go in `suite/drivers/ext/<id>.ts`, which you also
     own. It holds helpers that branch on `driver.name`, for example a
     `tagPost(driver, client, id, tags)` that calls
     `driver.mutate(client, 'PUT', driver.name === 'void' ? `/posts/${id}?update` : `/posts/${id}`, …)`.
     Build the helpers from `driver.mutate`, `driver.page`, `driver.sql`,
     `driver.raw` and the existing methods.
   - Where the hidden test reads the DB through the pinned table names, use
     `driver.sql(...)`. It is real SQLite on both apps, and the running Void
     dev server sees outside writes at once.
   - Where it reads Inertia props, use `driver.page(...)`.
   - Validation rejection: Guren answers 422 with JSON `{errors}`; Void
     answers 200 with page JSON whose `errors` is non-empty. Assert
     "rejected, field named, nothing saved".
   - Tests that need an empty DB check that first, the way the round-1
     pagination test does.
   - Keep `Bun.sleep` waits only where the original has them, for timestamp
     ordering.
6. `tasks/<id>/PORTING.md`: what changed in each statement, a mapping from
   each hidden-test case to your test case, anything you could not port and
   why, and the validation results.

## Validation gate (required)

Each run takes the task name as its argument:

```bash
SUITE_PORT=<your guren port> RUNS=2 bash suite/validate-guren.sh <id>
SUITE_PORT=<your void port>  RUNS=2 bash suite/validate-void.sh <id>
```

- **Guren:** the start state (0fd1654 after `bun update`, no seed) must FAIL,
  and start + agents-on-guren `reference.patch` must PASS, 2× each.
- **Void:** the start state must FAIL, and start + your `reference.void.patch`
  must PASS, 2× each.
- The Void script holds a machine-wide lock, so Void runs from parallel
  agents queue. Waiting is normal.
- Use the ports from your prompt. Never kill processes you did not start.
  Clean up your own `$WT_ROOT/port-<id>` copy when you are done.
- Disk is nearly full, so do not leave extra copies of apps around.

Before you finish, break your Void reference at least 2 ways (for example,
drop an authorization check, or skip a validation) and confirm the test fails.
Note this in PORTING.md.

## Final message

In your final message, report:

- the validation table (both arms × {start, reference} × 2)
- the statement differences, in one line each
- anything that makes the two arms unequal (work the Void statement demands
  more or less of)
- any shared-file change you need
