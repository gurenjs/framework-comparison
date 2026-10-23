# Porting notes: post-revisions

Source: `agents-on-guren/tasks/post-revisions` (statement.md,
hidden/post-revisions.test.ts, hidden/_revisions-db.ts, reference.patch).
Ported files:

| file | what it is |
|---|---|
| `task.json` | stage 2, 200 turns |
| `statement.guren.md` | verbatim copy of the agents-on-guren `statement.md` |
| `statement.void.md` | the same ticket for the Void app (changes below) |
| `reference.void.patch` | the Void solution, `git diff` from the app root |
| `../../suite/tests/post-revisions.test.ts` | the shared black-box test |
| `../../suite/drivers/ext/post-revisions.ts` | the per-framework helpers the test uses |

## Statement changes (Guren -> Void)

Product text, the worked example, the pinned contract (table
`post_revisions` and its six columns, `revisions: [{ id, title, createdAt }]`
newest first, both URLs, 403 / login redirect / 404, delete removes the rows)
and the out-of-scope list are the same. Only these lines differ:

1. **"History is private" bullet.** "guests are sent to the login page, the
   same way editing works today" became "... the same way a guest opening a
   post's edit page is today". On the Void app a guest's edit *submission*
   (`PUT /posts/:id?update`, `requireAuth`) answers 401, not a redirect; only
   the edit *page* redirects a guest to `/login`. The hidden test requires the
   redirect on both routes, so the reference point had to be one that
   redirects on Void (comments-moderation hit the same thing). The contract
   line "A guest is redirected to `/login` on both routes" is unchanged.
2. **Contract, `GET /posts/:id/revisions`.** "a page whose props include" /
   "extra props are fine" became "a page whose page data includes" / "extra
   page data are fine". Void pages have no Inertia props; the loader's return
   value is the page data.
3. **Acceptance paragraph.** "checks the page props" became "checks the page
   data", same reason.

Not changed on purpose:

- Both URLs stay as pinned. `GET /posts/:id/revisions` is a plain page URL on
  Void. `POST /posts/:id/revisions/:revisionId/restore` is not a named action
  of an existing page, so (as with comments-moderation's `/comments/:id`) it
  stays framework-neutral; the Void app can serve it from a server route (the
  reference does) or any other way. The test sends the same path on both
  arms.
- The edit endpoint is not named in either statement ("the existing edit
  endpoint").
- No Void API is named (no `db.batch`, `onDelete`, `userOrRedirect`,
  `HTTPException`, `routes/`, `void db generate`). The Guren statement names no
  CSRF, Inertia or `bun run`, and no user ids, so there was nothing else to
  translate. No validation errors are involved.

## Hidden test -> suite test

The hidden test runs in-process: `makePost` inserts posts, `Post.find` reads
them, `revisionRows` reads `post_revisions` by table name. Here posts are
created through the create form (`driver.createPost`), post content is read
from `posts` and revisions from `post_revisions` through `driver.sql`. Every
assertion is scoped to the posts the case creates, so one database for the
whole file (instead of `freshApp()`) changes nothing and no empty-DB check is
needed. The `Bun.sleep(1100)` between the two edits is kept. The per-case
timeout is 60 s instead of 20 s (three edit pairs plus Better Auth sign-ups
over HTTP against a dev server; a full Void run of the file took 30.6 s).

| hidden case | suite case | differences |
|---|---|---|
| keeps the previous version on every edit and lists revisions newest first | same name | Edits via `submitUpdate` (Guren `PUT /posts/:id`, Void `PUT /posts/:id?update`). The 0-rows check right after creating now also covers "creating keeps nothing" through the real create form. Page data read with `driver.page` (Inertia props / Void page data), status 200. Ids compared with `Number()` on both sides. |
| restores a revision, redirects to the post, keeps the pre-restore state | same name | Restore sent with `driver.mutate` (Guren CSRF header; Void Origin). `location` is the redirect pathname. `Post.find` -> `select title, excerpt, body from posts`. |
| refuses another signed-in user with 403 | same name | List read with `driver.page` (the hidden test sends `X-Inertia`); 403 on both. |
| sends a guest to the login page | same name | Guest = fresh client. List is a plain `GET` (no page-data headers) through `driver.raw`, as the hidden test's plain `guest.get`; restore through `driver.mutate` (primes guest CSRF on Guren, like `withCsrf()`). |
| answers 404 for a revision of another post | same name | Unchanged, including the cross-user follow-up (`[403, 404]`). |
| removes a post's revisions when the post is deleted | same name | Delete through `driver.deletePost` (Guren `DELETE /posts/:id`, Void `DELETE /posts/:id?delete`), `ok` = 302/303. `Post.find(...) === null` -> no `posts` row. |

Nothing was left unported. The component name of the revisions page is not
pinned by the ticket and is not checked.

## Void reference (`reference.void.patch`)

- `db/schema.ts`: `post_revisions` (`post_id` references `posts.id` with
  `ON DELETE CASCADE`, so the history goes with the post; `created_at` the same `strftime` ISO
  default as `posts`). Migration from `npx void db generate`.
- `lib/revisions.ts`: `updateKeepingRevision` (insert the current version and
  update the post in one `db.batch`, as the D1 docs recommend in place of a
  transaction), `listRevisions` (newest first by `created_at`, then `id`),
  `findRevisionOrFail` (scoped to the post in the URL, else 404).
- `pages/posts/[id].server.ts`: the `update` action calls
  `updateKeepingRevision` after validation and `authorizeAuthor`, so a refused
  edit keeps nothing.
- `pages/posts/[id]/revisions.server.ts` + `.tsx`: loader with
  `userOrRedirect` (guest -> `/login`) and `authorizeAuthor` (403); the page
  lists revisions with a Restore button.
- `routes/posts/[id]/revisions/[revisionId]/restore.ts`: `POST`, guest ->
  `/login`, author check (403), scoped lookup (404), `updateKeepingRevision`,
  redirect to `/posts/:id`.
- `pages/posts/[id].tsx`: a Revisions link for the author.
- `pnpm typecheck` passes.

## Validation

`SUITE_PORT=4131 RUNS=2 bash suite/validate-guren.sh post-revisions` and
`SUITE_PORT=4231 RUNS=2 bash suite/validate-void.sh post-revisions`:

| arm | state | run 1 | run 2 |
|---|---|---|---|
| Guren | start (0fd1654 + `bun update`) | FAIL 0/6 | FAIL 0/6 |
| Guren | start + agents-on-guren `reference.patch` | PASS 6/6 | PASS 6/6 |
| Void | start | FAIL 0/6 | FAIL 0/6 |
| Void | start + `reference.void.patch` | PASS 6/6 | PASS 6/6 |

On both start states every case fails on `no such table: post_revisions`.

Breaking the Void reference (one `suite/run.sh` run each, on the port copy):

- `post_id` dropped from the restore lookup: 5 pass, 1 fail ("answers 404
  for a revision id that belongs to another post").
- Restore updates the post without keeping the pre-restore version: 5 pass,
  1 fail ("restores a revision ...": 2 rows instead of 3).
- Restore uses `requireAuth` instead of a login redirect: 5 pass, 1 fail
  ("sends a guest to the login page": 401).

## Arm (in)equality

- Same product work on both arms: a table plus migration with a cascading
  foreign key, snapshot-on-update, a new page, a restore endpoint, an
  ownership check, a scoped lookup, and a link.
- Guren has a model layer (`defineModel`, `hasMany`, `firstOrFail`,
  `Model.transaction`), policies and route params schemas; Void has Drizzle
  queries, `db.batch` in place of a transaction, and hand-written
  `HTTPException` 403/404 helpers the app already has (`authorizeAuthor`,
  `findPostOrFail`). Neither arm needs a workaround the other does not.
- One Void-specific trap with no Guren twin: the app's existing
  `requireAuth` answers 401 for guests, so the guest redirect must come from
  the redirect guard the pages use. The statement says "redirected to
  `/login`", so this is spelled out, not hidden. The Guren arm's matching trap
  (routes outside the `auth` group give the guest 403) is of the same size.
- On Void the restore endpoint is not a page action; the agent must choose
  where to serve it (server route or otherwise). On Guren it is one more route
  in `routes/web.ts`. Comparable effort.
