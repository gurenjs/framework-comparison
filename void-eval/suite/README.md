# Black-box HTTP acceptance suite (Guren and Void)

These shared `bun test` files grade one app over real HTTP. The tests never import app code and never touch the database. They talk to a running server only through a per-framework **driver** (`drivers/<name>.ts`), which implements `drivers/types.ts`. The test files are identical for every framework. Everything framework-specific, such as CSRF, Inertia/VoidPages headers, cookie names, how ids are found, and what counts as success, stays inside the driver.

Pilot tasks are ported from `agents-on-guren/tasks/<id>/hidden/*.test.ts`:

| test file | task |
|---|---|
| `tests/missing-authorize-destroy.test.ts` | non-author / guest / author `DELETE` of a post |
| `tests/pagination-skips-page.test.ts` | `/posts` paging, 25 posts |
| `tests/raw-body-no-validation.test.ts` | `PUT /profile` validation and mass-assignment |
| `tests/api-posts-contract.test.ts` | public `GET /api/posts` JSON contract |
| `tests/extras/api-posts-contract.integer-author.test.ts` | Guren-only extra, **not graded** |

## Running

```sh
# one task: boot on a fresh DB, run the test file, stop the server, exit with the test status
./run.sh guren /path/to/guren-app missing-authorize-destroy [port]   # default port 4100
SUITE_EXTRAS=1 ./run.sh guren /path/to/guren-app api-posts-contract   # also runs (ungraded) extras

# against an already-running server
SUITE_DRIVER=guren SUITE_BASE_URL=http://127.0.0.1:4100 bun test --timeout 30000 ./tests/<task>.test.ts

# the validation gate (seeded must FAIL, seeded+reference must PASS, 2x each)
./validate-guren.sh [task...]
```

* `run.sh <driver> <app> <task> [port]` calls `boot-<driver>.sh <app> <port>`. That script must print the server PID on stdout and exit 0 once the server is ready. `run.sh` exits 0 if every test passed, 1 if any test failed, 2 on a usage error and 3 if the boot failed. Extras never change the exit status.
* `boot-guren.sh <app> <port>` does the following:
  * Refuses to start if the port already answers, so a stale server can't be graded instead.
  * Does first-time setup if it is missing: `bun install`, `.env` plus `APP_KEY`, and the vite client+SSR build. It always runs `bun run codegen`.
  * Deletes `data/suite.db*` and starts `bun bin/serve.ts` with `NODE_ENV=production`, `GUREN_STRICT_PORT=1`, `APP_URL=http://127.0.0.1:<port>` and `DATABASE_URL=./data/suite.db`.
  * Production mode applies migrations on boot and does **not** seed. Every run therefore starts on a migrated, empty database.
  * Polls `/health`, checks the PID is still alive, and prints the PID. The server log is `<app>/data/suite-server.log`. Set `SUITE_REBUILD=1` to force the vite build.
* `boot-void.sh <app> <port>` starts `vp dev` (Void's local runtime: miniflare, local D1, no Cloudflare account) on an emptied local state (`.void/v3` removed), waits for `/posts` to answer 200, which also means the migrations ran, and prints the PID. It retries a stalled cold start up to 3 times.
* Void runs hold a machine-wide lock (`/tmp/void-suite.lock`) from boot to shutdown in `run.sh`, because two `vp dev` servers at once collide. Never start a Void server outside `run.sh` while a validation or a matrix is running.
* There are no dependencies beyond bun built-ins (`bun:test`, `fetch`).

Some tests require an empty posts table at start: pagination and API. They check `meta.total === 0` on the post list first and throw a clear harness error otherwise, so leftover rows can't skew the counts. All other tests register fresh users with unique emails, so they are independent of each other and of reruns.

## Driver contract (`drivers/types.ts`)

The driver is selected by `SUITE_DRIVER=guren|void` and gets its base URL from `SUITE_BASE_URL`. `drivers/index.ts` returns a `GurenDriver` or a `VoidDriver`.

* **Every request** uses `redirect: 'manual'`, so 302 and 303 stay observable. Every request also goes through the `Client`'s cookie jar (`lib/cookies.ts`).
* **Ids** are `Id = string | number`. Tests only compare ids; they never do arithmetic on them.
* `newClient()` returns a signed-out browser.
* `register(c, {name,email,password})` leaves `c` signed in and throws on failure.
* `login(c, creds)` returns `{ok}` and does not throw on bad credentials. `ok` must mean "this client is now signed in as that account". The Guren driver confirms this through the profile page, because a redirect alone is not proof.
* `createPost(c, post)` returns `{id}`. If the id comes from a redirect `Location`, compare pathnames only, because Void's carries a query.
* `deletePost(c, id)` and `updateProfile(c, body)` return a `MutationResult` `{status, ok, errors, bodyText}`:
  * `status` is the raw HTTP status. Tests assert it only where both frameworks agree: 403 for a non-author delete, and 302/401/403 for a guest delete.
  * `ok` is the driver's own success contract. Guren delete is ok on 302/303; Guren profile update is ok on 200/302/303.
  * `errors` holds field-keyed validation errors and is non-empty **only** for the framework's real validation-failure shape. For Guren that is 422 JSON `{errors}`; for Void it is a 200 page JSON with `errors`. The tests check `ok === false` plus `errors.<field>` for a rejection, and `ok === true` plus `errors` equal to `{}` for an acceptance.
  * `updateProfile` sends `body` verbatim, extra keys included.
* `getPostStatus(c, id)` returns the status of the public post page: 200, or 404 when the post is gone.
* `getPost(c, id)` returns `{id, title, author:{id,name}}` from the post page, or null. `author.id` must be the same value `/api/posts?author=` accepts. It is the only black-box way the tests learn an account id.
* `listPosts(c, {page?})` returns the public list page as `{ids (in display order), meta:{currentPage,lastPage,perPage,total,from,to}}`. Leaving `page` out means no query parameter at all. It throws if the response is not a 200 list.
* `getProfile(c)` returns `{name,email}` as the profile page shows them, or null when the page is unreachable (for example, redirected to login).
* `absentUserId()` returns a well-formed user id that belongs to no account.
* `raw(c, method, path, init)` is a plain fetch with the jar and manual redirects. It is used only for `/api/posts`, whose wire contract is itself under test.
* `capabilities.profilePassword`: the profile form has an optional `password` field. When it is false, tests never send `password`.
* `capabilities.integerUserIds`: enables the ungraded integer-author extra.

### Guren specifics, all handled in `drivers/guren.ts`

* **CSRF.** Every response may set an `XSRF-TOKEN` cookie:
  * Guests get a stateless double-submit token.
  * After login or register, the token is bound to the `guren.session` id. It is re-issued on the 303 redirect, and the jar picks it up.
  * Mutations send the current cookie value, URL-decoded, as `X-XSRF-TOKEN`.
  * If the jar has no token, the driver primes one with `GET /health`.
  * A `403 {"message":"CSRF token mismatch"}` makes the driver **throw**. A harness CSRF failure can never pass for an authorization 403.
* **Reads.** Requests send `X-Inertia: true`, `X-Requested-With`, and the cached `X-Inertia-Version`, and get back the page object as JSON. If the version is unknown or stale, the server answers 409. The driver then reads `X-Inertia-Version` from a plain HTML GET and retries once.
* **Mutations** use real verbs (`POST /register`, `POST /login`, `POST /posts`, `DELETE /posts/:id`, `PUT /profile`) with a JSON body and `Accept: application/json`. They are sent **without** `X-Inertia`, like a plain HTTP client and like the hidden tests' `TestApp`. With `X-Inertia`, Guren turns a validation failure into a flash plus a 303 back, instead of a 422.
* The id of a created post is parsed from the `Location: /posts/<id>` redirect.

## What each test checks, mapped to the hidden test

### missing-authorize-destroy (3 cases, the same as the hidden test)

* **Non-author.** The delete must return 403, and the post page must still return 200. The hidden test checks `Post.find` is not null.
* **Guest.** The status must be one of 302/401/403, and the post page must still return 200. A guest is a fresh, cookie-less client. The Guren driver primes guest CSRF, as `withCsrf()` does.
* **Author.** The delete must give `ok`, and the post page must return 404. The hidden test checks 302/303 and `Post.find` is null. 302/303 is now enforced as the Guren driver's `ok`.

### pagination-skips-page (6 cases, the same as the hidden test)

The hidden test deletes all posts first. Black-box, the test instead requires an empty DB and then creates 25 posts through the UI flow. "Newest first" means reverse creation order; there is a 2 ms gap between creates so timestamps are distinct. The cases cover:

* the default page, `?page=1`, `?page=2` and `?page=3` (exactly 5 posts);
* every post appearing exactly once;
* meta `{currentPage,lastPage,perPage,total,from,to}` for all three pages.

### raw-body-no-validation (5 hidden cases + 1 from the statement)

The hidden test reads the `users` row directly. Black-box, account state is observed through three things:

* the profile page (`name`, `email`);
* signing in again on a fresh client, which proves the email and the password hash;
* a post written before the update, whose page must still resolve its author, which proves the account id.

Cases:

* **Bad email.** The update is rejected with `errors.email`, the profile is unchanged, and the original credentials still log in. The hidden test checks 422, which the Guren driver enforces.
* **Empty name.** The update is rejected with `errors.name`, and the profile is unchanged.
* **Valid update.** The update is accepted and the profile shows the new name and email. The hidden test asserts `passwordHash` is unchanged; here, logging in with the original password and the new email must work.
* **Normalization (extra, from the statement).** `'  Trimmed Name  '` and `'  EMAIL '` must be stored as `Trimmed Name` and the lowercase email. The hidden test does not have this case.
* **Extra fields** (`passwordHash`, `role`). The update is accepted, the valid fields are saved, and the original password still logs in. The hidden test compares `passwordHash` directly.
* **`id: 999999`.** The update is accepted, and the same session still sees the updated profile. The post written under the original id still shows the author's new name. The hidden test checks `User.find(id)` exists and `User.find(999999)` is null; the session and the post's foreign key are the black-box stand-ins.
* When `capabilities.profilePassword` is false (Void), `password: ''` is left out of every body.

### api-posts-contract (8 shared cases + 1 ungraded extra)

All requests come from a cookie-less client with `Accept: application/json`, and every response must be `application/json`. The fixture is 12 posts alternating between authors A and B; the newest goes to A, giving A 7 posts and B 5. That matches the hidden test, except the posts are created over HTTP with a 5 ms gap instead of with explicit `createdAt` values. Author ids are read from the post pages (`getPost`).

Shared cases:

* The 10 newest posts with meta `{1, lastPage 2, perPage 10, total 12}`.
* Field types: `id` and `author.id` may be a number or a string; `title`/`excerpt` are non-empty strings; `createdAt` is ISO-parsable; `author` is `{id,name}` and correct.
* Page 2 holds the 2 oldest posts.
* `?author=A`: 7 posts, newest first, total 7.
* `?author=B&page=1`: 5 posts.
* An **author with no posts** returns 200, empty `data`, and `total: 0`. The hidden test filters by a fresh user's id. Black-box, an account id is only visible through a post it wrote, so the user writes one, its id is read, and the post is deleted.
* An **author id that matches no account** returns 200, empty data, and total 0. This was added on request.
* `page=0` and `page=abc` must answer **400 or 422** with a JSON body. The hidden test requires exactly 422; Void's route validators answer 400.

The extra, `tests/extras/api-posts-contract.integer-author.test.ts`, runs only when `capabilities.integerUserIds` is true and `SUITE_EXTRAS=1`. It checks the hidden test's strict 422 for `page=0`, `page=abc`, `author=abc` and `author=0`. It is not part of the shared grade, because Void ids are opaque strings, so `author=abc` and `author=0` have no meaning there.

## Criteria not ported black-box

* **api-posts-contract, second `describe` ("typed API surface").** It checks three things:
  * the route is named `api.posts.index`;
  * `app.router.definitions()` carries a `schemas.query` that accepts `{page:'2',author:'3'}` and rejects `page:'0'` and `author:'abc'`;
  * `.guren/api-client.gen.ts` has an `'api.posts.index'` entry with `response:`.

  These are static or in-process checks of the source and generated code, not HTTP behaviour. Grade them **separately per framework** with a static check outside this suite. For Guren that check is the original hidden test's second block, run in-process. Void needs its own equivalent: a named route and a typed client entry.
* **Direct DB assertions** (`Post.find`, `User.find`, `passwordHash` equality) are replaced by the observable proxies described above. One known gap: overwriting `passwordHash` with a value that still verifies the original password would go undetected. That is not realistic for the seeded bug.
* **Explicit `createdAt` fixtures** (api task) are replaced by creating posts in sequence with small sleeps.

## Validation (Guren driver)

`./validate-guren.sh` does the following for each task:

1. Runs `git worktree add --detach /tmp/suite-wt-<task> 0fd1654` from `agents-on-guren-app`.
2. Applies `seed.patch` if the task has one, then runs `harness/lib.sh setup_app`.
3. Runs `run.sh` twice and expects FAIL.
4. Restores the tracked `.guren` files that codegen rewrote, applies `reference.patch`, runs `run.sh` twice more and expects PASS.
5. Removes the worktree.

Logs go to `/tmp/suite-validate-logs/`. For the results, see the report that accompanied this suite. On the last run, every task failed seeded and passed with the reference patch, 2/2 each.

## Stage 2 tickets and the generic driver API

The five Stage 2 tickets (post-tags, comments-moderation, post-revisions, json-api-tokens, scheduled-publish) add a test per ticket and a helper file `drivers/ext/<ticket>.ts`. The helpers branch on `driver.name` only for what the ticket's statements pin differently, such as a named action URL or a JSON validation status. Everything about the base app goes through the driver:

* `mutate(client, method, path, body?, { headers?, pages? })` sends a form submission the way the framework's client does: the CSRF header on Guren, `Origin` (+ `X-VoidPages` unless `pages: false`) on Void. It returns `{ status, ok, errors, bodyText, location, headers }`. A refusal by the framework's own CSRF or origin check throws, because it is a harness bug. On Void the check is matched exactly: `Cross-origin page actions are not allowed.` or a Better Auth `MISSING_OR_NULL_ORIGIN` / `INVALID_ORIGIN` code.
* `page(client, path)` returns `{ status, component, props }` through the page-data protocol.
* `updatePost`, `userIdByEmail`, `components.{postIndex,postShow}` and `formValidationStatus` are base-app facts the tickets share.
* `sql(query, params)` runs SQL on the app's SQLite (`lib/db.ts`): Guren `data/suite.db`, Void's local D1 file. The running Void dev server sees outside writes at once. Use it only for the tables a ticket pins.
* The Void driver's `raw` re-sends a request once when `vp dev` answers with its own HTML "fetch failed" page instead of reaching the Worker. That happens after a handler answered without reading the request body. The re-send is logged to the console.

Each ticket's statement differences, the case-by-case mapping to the hidden test, and its validation results are in `../tasks/<ticket>/PORTING.md`.
