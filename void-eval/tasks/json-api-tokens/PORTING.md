# Porting notes: json-api-tokens

Source: `agents-on-guren/tasks/json-api-tokens` (statement.md,
hidden/json-api-tokens.test.ts, hidden/_api-tokens-db.ts, reference.patch).
Ported files:

| file | what it is |
|---|---|
| `task.json` | stage 2, 200 turns |
| `statement.guren.md` | verbatim copy of the agents-on-guren `statement.md` |
| `statement.void.md` | the same ticket for the Void app (changes below) |
| `reference.void.patch` | the Void solution, `git diff` from the app root |
| `../../suite/tests/json-api-tokens.test.ts` | the shared black-box test |
| `../../suite/drivers/ext/json-api-tokens.ts` | the per-framework helpers the test uses |

## Statement changes (Guren -> Void)

The product text, the pinned contract (table `api_tokens`, the plain-text
rule, `POST /profile/tokens` -> 201 `{ id, name, token }`,
`DELETE /profile/tokens/:id` -> 204 / 404, `GET`/`POST /api/posts` and their
`{ data }` shapes, 401 JSON, the 403 allowance, 429 + `Retry-After` per token)
and the closing "what the acceptance run does" paragraph are the same. Only
three passages differ:

1. **Token name validation.** "answers **422**" became "answers **400 or
   422**". The URL is a JSON route, not a page action. Void's route validators
   answer validation failures with 400 JSON (`server-routing.md`, "Validation
   errors"), so 422 alone would make the agent replace the framework's
   validation response by hand. The brief allows JSON routes to use 400 or
   422.
2. **API post validation.** "answers **422** with a JSON body" became "answers
   **400 or 422** with a JSON body", for the same reason.
3. **`authorId` is a string.** The list item now says "`authorId` is the
   author's user id (a string, as user ids are in this app)". Void users are
   Better Auth users with opaque string ids.

Not changed on purpose:

- No Void API is named (no `defineDurableState`, `defineMiddleware`,
  `withValidator`, `crypto.subtle`, `void db generate`). The Guren statement
  names no Guren API either.
- The 403 allowance for a write with no bearer token stays verbatim. On Void it
  covers an app that adds its own `Origin` check to the API routes.
- There was no Inertia, CSRF or `bun run` wording to translate, and there are
  no page-data props in the contract. The profile page is described as product
  text only ("lists them by name"), and the test does not read it.

## Hidden test -> suite test

The hidden test resets the DB once for the whole file (`beforeAll(freshApp)`).
The suite also boots once per file on a fresh, empty DB, so before/after
comparisons map one to one. Every case registers fresh users.

How the hidden test's tools were replaced:

- `asUser(http, user)` plus `withHeaders(JSON_ACCEPT)` became
  `sessionRequest(driver, user.client, …)`. It is the registered client's
  cookie jar plus `Accept: application/json`, a JSON body, and the framework's
  same-origin credential:
  - Guren: the `XSRF-TOKEN` cookie echoed as `X-XSRF-TOKEN`, as `TestApp`
    does.
  - Void: `Origin`, as a same-origin browser `fetch` sends.

  It sends no `X-Inertia` or `X-VoidPages` header, because these are JSON
  routes. A CSRF/origin 403 throws as a harness error.
- `bearer(http, token)` became `apiRequest(driver, …, 'Bearer <token>')`. It
  uses a brand-new cookie jar for every request, so no session cookie and no
  CSRF cookie are ever sent, as the statement promises. Nothing
  framework-specific is added.
- `apiTokenRows` / `apiTokenCells` became `driver.sql('SELECT * FROM
  api_tokens')`. They scan every column of every row, as the hidden helper
  does.
- `Post.forceCreate` (with explicit `createdAt`) became an
  `INSERT INTO posts (title, excerpt, body, author_id, created_at)` through
  `driver.sql`. Both apps have these column names and an ISO 8601 text
  `created_at`. `Post.find` / `Post.all().length` became `SELECT … FROM
  posts`.
- `user.id` became `userId(driver, user)`: a lookup by email in Guren's `users`
  or Void's `"user"` table.

| hidden case | suite case | differences |
|---|---|---|
| creates a token as JSON … stores only a hash | same name | none beyond the tool swaps above |
| refuses a token name that is missing, empty or > 50 | same name | status must be in `jsonValidationStatuses(driver)`: Guren `[422]` (strict, as the hidden test), Void `[400, 422]` (statement change 1). A missing name is sent as `{}`, which is what `JSON.stringify({ name: undefined })` sends in the hidden test |
| does not let a guest create a token | same name | a fresh client with the guest same-origin credential (Guren primes guest CSRF the way `withCsrf()` does) |
| revokes a token with 204 … | same name | none |
| answers 404 when revoking another user's token … | same name | none |
| lists every author's posts newest first … | same name | fixture through SQL insert (above), the same `BASE + i*60s` timestamps; `authorId` compared with the id from the users table |
| creates a post as the token's owner … | same name | `authorId: other.id` in the body is the other user's real id (string on Void); stored row read with SQL |
| rejects an invalid post with 422 JSON … | "rejects an invalid post with a JSON validation error …" | status in `jsonValidationStatuses(driver)` (statement change 2), JSON body required, post count unchanged |
| answers 401 JSON to a missing, malformed, unknown or tampered token … | same name | none; credentialless write still `[401, 403]` |
| allows 60 requests per minute per token … | same name | same minute-alignment `Bun.sleep`, same 60 s timeout, same 60 + 1 + other-token sequence |

Nothing was left unported.

### Void dev-server retry (in the ext, Void only)

Under `vp dev`, a Void handler can answer a request without reading its body,
for example a 401 to a `POST /api/posts`. After that, Vite's proxy to workerd
sometimes fails the *next* request with Vite's own HTML 500 page
(`{"message":"fetch failed"}`, no `Content-Type`). Probes on the reference
without any workaround:

- POST with a bad token, then GET: 3 of 15 GETs were 500.
- POST with a bad token, then POST with a valid token, 20 times: 19 were 201
  and 1 was 500, and exactly 19 rows were created.
- 60 GETs with a token, each after a refused POST: 8 of the GETs were 500, and
  the 429 still came only after 60 successful requests.

A failed request therefore never reached the worker. The ext re-sends a
request once when it gets exactly that page. The test logs how many times this
happened. On the reference it fired once per run in 4 of the manual runs
(always in the 401 case) and 0 times in the 2 gate runs. Reading the body in
the app before returning the 401 also removes the flake (0 of 15). The
reference does **not** do this, because nothing in the Void docs asks for it,
and a reference that drained the body would hide the flake from the gate.

This only covers requests made through the ext. Shared driver calls
(`register`, `login`, `mutate`, `page`) have no such retry. A Void solution
that leaves a request body unread could still make the next driver call fail
(see the final report: shared-file change). This test has one such
transition: the 401 case ends with a refused, unread POST, and the next request
is the rate-limit case's `makeUser` -> `driver.register`, which has no retry. It
never failed in 6 reference runs. In a probe, a refused POST followed by a
request to a different route also failed 0 of 15 times. So the risk is low,
but not zero.

## Void reference (`reference.void.patch`)

- `db/schema.ts`: `api_tokens` (`id` random UUID text, `name`, `token_hash`
  unique, `user_id` text, `last_used_at`, `created_at`). The migration comes
  from `npx void db generate` and creates `api_tokens` only. There is no
  foreign key to Better Auth's `user` table, which `lib/users.ts` keeps outside
  the migrated schema on purpose.
- `lib/api-tokens.ts`:
  - `createApiToken` creates 32 random bytes as hex and stores the Web Crypto
    SHA-256 of them. The plain text is returned once.
  - `listApiTokens` returns names and dates only.
  - `revokeApiToken` deletes only where `id` and `user_id` both match.
  - `apiTokenAuth` (`defineMiddleware`) parses `Authorization: Bearer`, looks
    up the hash joined to the user, records `last_used_at`, and sets
    `apiUser` / `apiTokenId` on the context (typed through
    `CloudContextVariables`). Every failure is `401 {"message"}` JSON.
  - `apiTokenRateLimit` is the limiter. It runs after the auth middleware.
- `durable-objects/api-token-limiter.ts`: a `defineDurableState` fixed window,
  one instance per token id (`ApiTokenLimiter.get(tokenId)`). The Void docs
  name Durable State as the tool for a rate limiter. It answers
  `{ allowed, retryAfter }` (seconds, 1 to 60), and the middleware turns a
  refusal into 429 with `Retry-After`. `void.lock.json` (the Durable Object
  binding and migration Void recorded) is part of the patch, as the docs ask.
- `routes/profile/tokens/index.ts`: `POST`, using `withValidator` with
  `apiTokenPayloadSchema` (name trimmed, 1 to 50). It calls `requireAuth`, so
  a guest gets 401, and answers `c.json(…, 201)`.
- `routes/profile/tokens/[id].ts`: `DELETE` answers 204 (`return null`), or
  404 `HTTPException` when the token is not the user's.
- `routes/api/posts.ts`: `GET` and `POST`, both
  `defineHandler(apiTokenAuth, apiTokenRateLimit, …)`. The list is ordered by
  `created_at` desc, then `id` desc, and `createdAt` is normalized to ISO. The
  create path reuses `postPayloadSchema` through `withValidator`, which
  answers 400 and strips `authorId`. The author is the token's user, and the
  response is `c.json({ data }, 201)`.
- The profile page: the loader adds `tokens` (names and dates, never the
  hash). The page gets an "API tokens" section with a create form (typed
  `fetch` from `void/client`, shows the token once), a list, and Revoke
  buttons. It calls `router.refresh()` after each change.
- `pnpm typecheck` passes.

## Validation

`SUITE_PORT=4141 RUNS=2 bash suite/validate-guren.sh json-api-tokens` and
`SUITE_PORT=4241 RUNS=2 bash suite/validate-void.sh json-api-tokens`:

| arm | state | run 1 | run 2 |
|---|---|---|---|
| Guren | start (0fd1654 + `bun update`) | FAIL 0/10 | FAIL 0/10 |
| Guren | start + agents-on-guren `reference.patch` | PASS 10/10 | PASS 10/10 |
| Void | start | FAIL 0/10 | FAIL 0/10 |
| Void | start + `reference.void.patch` | PASS 10/10 | PASS 10/10 |

On both start states every case fails on the missing routes and table:
token creation answers 404 instead of 201, and the guest case finds no
`api_tokens` table (`apiTokenRows` throws "no such table"). No case fails
on a harness error (CSRF/origin check, driver). `reference.void.patch` applies cleanly to a fresh start state; the gate
does exactly that.

Breaking the Void reference (one run each, on the reference copy):

- The limiter keyed by user id (`ApiTokenLimiter.get(c.get("apiUser").id)`)
  gives 9 pass and 1 fail. The rate-limit case fails because the second token
  of the same account got 429.
- The revoke ownership condition dropped (`where(eq(apiTokens.id, id))`) gives
  9 pass and 1 fail. The 404 case fails because the intruder got 204.

## Arm (in)equality

- **Void has no token, bearer or rate-limit API; Guren has all three.** On
  Guren the idiomatic solution is `createApiToken`, `DatabaseApiTokenStore`,
  `createBearerTokenMiddleware` and `createRateLimitMiddleware`, plus a
  `Resource`. On Void the agent writes these by hand:
  - token generation and hashing (Web Crypto);
  - Bearer header parsing and the user lookup;
  - a rate-limit store. Durable State is what the docs point to. An in-memory
    `Map` also passes under `vp dev`, which has one isolate.

  Better Auth plugins (bearer, API keys) would change the pinned table and
  token behaviour, so they are no shortcut. The Void arm demands more
  handwritten work. That is a property of the frameworks, not of the port.
- **Guren's traps** (Date-valued timestamps, string token ids, limiter key and
  order, the CSRF 403 on credentialless writes) have no Void counterpart.
  Void's counterpart traps are a limiter keyed by user, and returning 201
  through `c.json(…, 201)`, because a plain return value is always 200.
- **Validation status.** Guren must answer exactly 422. Void may answer 400
  (its validator default) or 422. Both arms get the validation response their
  framework gives by default.
- **Dev-server flake (Void only).** See the retry section above. Requests
  through the ext are protected, and shared driver calls are not.
