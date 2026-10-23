# comments-moderation: porting notes

Source: `agents-on-guren/tasks/comments-moderation` (Stage 2, feat, H).

## Statements

`statement.guren.md` is a verbatim copy of the agents-on-guren `statement.md`.

`statement.void.md` differs only in these places:

| Where | Guren | Void | Why |
|---|---|---|---|
| Commenting bullet | guest sent to login "exactly like a guest who tries to write a post today" | "... like a guest who opens the new-post page today" | On the Void app a guest's `POST /posts` gets 401 from the page action, not a redirect; a guest opening `/posts/create` is redirected to `/login`. The hidden test requires the redirect, so the reference point had to be one that redirects on Void. |
| Contract, guest rule | "the same redirect to `/login` the rest of the app gives" | "a redirect to `/login`, the same one a guest opening `/posts/create` gets" | Same reason: "the rest of the app" is not uniformly a redirect on Void. |
| Comment endpoint | `POST /posts/:id/comments` | `POST /posts/:id?comment` | Void's post page already takes its mutations as named actions (`?update`, `?delete`). A named action on the post page is the only Void shape where a bad body "fails exactly the way an invalid post title fails" (200 page data with `errors.body`); a separate `routes/` endpoint would answer 400 JSON instead, contradicting that sentence. The parenthetical "(the page data's `errors` names `body`)" spells out what "the way an invalid post title fails" means on Void. |
| `DELETE /comments/:id`, `POST /comments/:id/report` | unchanged | unchanged | They are not mutations of a page that exists; the URLs are framework-neutral and the contract (redirect to the post / 403 / 204) is plain HTTP, so they stay as pinned. |
| Post page data | "its props gain `comments` ... The existing `post` prop is unchanged", "rendered with the existing `posts/Show` page" | "its page data gains `comments` ... The existing `post` in the page data is unchanged", "rendered with the existing post page" | Void has page data, not Inertia props, and the page component is `pages/posts/[id].tsx`. |
| `author.id`, `user_id` | (integer ids implied) | "`author.id` the user's string id", "`user_id` holds the user's string id" | Void users are Better Auth users with string ids. |
| How this will be checked | "reading the post page's props" | "reading the post page's data" | Wording only. |

No Void API, file or CLI that solves the ticket is named.

## Hidden test -> suite test

`hidden/comments-moderation.test.ts` (8 cases) -> `suite/tests/comments-moderation.test.ts` (8 cases, same names, same order). Framework differences are in `suite/drivers/ext/comments-moderation.ts`.

| Hidden case | Suite case | Notes |
|---|---|---|
| guest comment -> /login, nothing stored | same | Guest = fresh client (Guren: CSRF primed via `/health`, like `withCsrf()`). `location` pathname must end in `/login`; `comments` rows for the post read with `driver.sql`. |
| B comments on A's post, listed with author, oldest first | same | Account ids come from the users table by email (`users` on Guren, Better Auth's `user` on Void) through `driver.sql`. Post page read with `driver.page` as a guest; component must be `posts/Show` (Guren) / `posts/[id]` (Void). `Bun.sleep(15)` kept. |
| comment author deletes | same | `DELETE /comments/:id` sent with `Referer: <base>/posts/:postId`, as the hidden test does, so a "redirect back" and a redirect to the post agree. |
| post author deletes someone else's comment | same | |
| third user -> 403, comment stays | same | |
| three distinct reporters hide it, row kept | same | 204 asserted per report; `comment_reports` count via `driver.sql`. |
| same user reports twice -> 204 twice, one row | same | |
| deleting a post removes its comments | same | Uses `driver.deletePost` (`DELETE /posts/:id` / `DELETE /posts/:id?delete`); its `ok` enforces 302/303 as the hidden test does. |

The Referer header is the reason the ext has its own `send()`: `Driver.mutate` has no header parameter. `send()` rebuilds each driver's mutation headers (Guren: `X-XSRF-TOKEN` from the jar, `Accept: application/json`, no Inertia header; Void: `Origin`, `X-VoidPages`) on top of `driver.raw`, and throws on a CSRF/origin rejection exactly as the drivers do.

Not ported: nothing. The hidden test has no validation case (1-2000 chars), so neither does the port.

## Void reference (`reference.void.patch`)

- `db/schema.ts`: `comments` (`post_id` FK `ON DELETE CASCADE`, index on `post_id`), `comment_reports` (`comment_id` FK cascade, unique index on (`comment_id`, `user_id`)). `user_id` is text with no FK, like `posts.author_id` (the Better Auth `user` table is not ours to migrate). Migration generated with `npx void db generate`; it creates only the two tables.
- `lib/validators.ts`: `commentPayloadSchema` (trimmed, 1-2000), `commentIdSchema`.
- `lib/comments.ts`: visible comments (excluding ids with >= 3 reports, oldest first, joined to the author), comment lookup with its post's author, the delete authorization.
- `pages/posts/[id].server.ts`: loader returns `comments`; named action `comment` (validator, guest -> `/login`, redirect to the post).
- `routes/comments/[id]/index.ts` (`DELETE`) and `routes/comments/[id]/report.ts` (`POST`, `onConflictDoNothing`, returns `null` -> 204). Guests are redirected to `/login` (`userOrRedirect`), not 401.
- `pages/posts/[id].tsx`: comment list, form (`useForm`), Delete/Report buttons via the typed `fetch` from `void/client`.
- `pnpm typecheck` passes.

## Validation

| Arm | Phase | run1 | run2 | Expected |
|---|---|---|---|---|
| Guren (port 4121) | start (0fd1654 + `bun update`) | FAIL 0/8 | FAIL 0/8 | FAIL |
| Guren | start + agents-on-guren `reference.patch` | PASS 8/8 | PASS 8/8 | PASS |
| Void (port 4221) | start | FAIL 0/8 | FAIL 0/8 | FAIL |
| Void | start + `reference.void.patch` | PASS 8/8 | PASS 8/8 | PASS |

The Void gate was re-run after the coordinator fixed `suite/run.sh` (trap set before boot), with no other Void runs active. Logs: `/tmp/suite-validate-void-logs-cm/`, `/tmp/suite-validate-logs-cm/`.

Breaking the Void reference (each a single edit, run once with `run.sh`):

1. Post author can no longer delete (`canDeleteComment` checks only `comment.userId`): 7 pass / 1 fail ("lets the post's author delete someone else's comment on it").
2. Blind insert for reports (`.onConflictDoNothing()` removed): 7 pass / 1 fail ("records one report when the same user reports a comment twice"; the second report hits the unique pair, so it is not a 204).

Boot note: on a cold copy, `boot-void.sh` sometimes needed all 3 of its 90 s attempts before `/posts` answered (Vite optimizer on the first start). One early run failed all 3 attempts while another agent's Void server was running at the same time. It booted on later runs.
