# Porting notes: scheduled-publish

Source: `agents-on-guren/tasks/scheduled-publish` (Stage 2, feat, H):
`statement.md`, `hidden/scheduled-publish.test.ts`, `hidden/_scheduled-db.ts`,
`reference.patch`. Ported files:

| file | what it is |
|---|---|
| `task.json` | stage 2, 200 turns |
| `statement.guren.md` | the agents-on-guren `statement.md` with the ops report removed (below) |
| `statement.void.md` | the same ticket for the Void app (changes below) |
| `reference.void.patch` | the Void solution, `git diff` from the app root |
| `../../suite/tests/scheduled-publish.test.ts` | the shared black-box test |
| `../../suite/drivers/ext/scheduled-publish.ts` | the per-framework helpers the test uses |

## The ops report is removed from both statements

The original ticket also asks for an ops report, a console command
`bun run console posts:scheduled` that prints `<id>\t<title>\t<published_at>`
lines, soonest first. `hidden/scheduled-command.test.ts` checks it by running
the command. Void has no console-command facility comparable to Guren's
console kernel and `make:command`. On Void the report would be an ad-hoc
script, so the arms would not be doing comparable work. Following the
coordinator's instruction, the report is removed from **both** statements:

- `statement.guren.md` is the original with exactly two bullets removed: "Ops
  wants a quick report." in "What we want", and "The report:" in the contract.
  Nothing else changed. The header line "with a small ask from ops" stays as
  written.
- `statement.void.md` derives from that text.
- `hidden/scheduled-command.test.ts` is not ported.
- The Guren `reference.patch` still adds the command (`ScheduledPostsCommand`
  and its registration in `src/console.ts`). This is harmless because no
  remaining case exercises it.

## Statement changes (Guren -> Void)

Product text, the pinned contract (column `posts.published_at` as ISO text,
field `publishAt`, 404/200 on the post page, `publishedAt` on the post,
absence from list and search, time passing through the database) and the
out-of-scope list are the same. Only these lines differ:

| Where | Guren | Void | Why |
|---|---|---|---|
| Form field, edit request | `PUT /posts/:id` | `PUT /posts/:id?update` | Updating a post is the post page's named action on Void. |
| Form field, invalid value | "rejected exactly the way an empty title is rejected today, and nothing is saved" | same, plus "(the page data's `errors` names `publishAt`)" | On Void an empty title gives a 200 page response whose `errors` names the field, not an error status. The parenthetical says what "the same way" means there, as the comments-moderation port does. The Guren arm gets the same requirement from its 422 `{errors}` (the hidden test checks `publishAt` in the keys). |
| Post page | "`publishedAt` ... on the `post` prop" | "on the post in the page's data (`post`)" | Void has page data, not Inertia props. |
| Posts list | "absent from the `data` prop" | "absent from the page's data (`data`)" | Same reason. |
| Search | "the existing `/posts/search` request" | "the posts list's existing keyword search (`GET /posts?q=…`)" | The Void app has no separate search endpoint. Its search is the `q` parameter of the list page, served by the same loader (the Guren app has `QUERY /posts/search` with a JSON body). "absent from `data`" stays as written. |
| Closing paragraph | "Extra props, extra keys ..." | "Extra page data, extra keys ..." | Wording only. |

User ids do not appear in this ticket, and the statement mentions no CSRF,
Inertia or `bun run`, so neither needed translating. No Void API is named:
not `withValidator`, `z.iso.datetime`, `getUser`, Drizzle operators or
`void db generate`.

## Hidden test -> suite test

`hidden/scheduled-publish.test.ts` has 5 cases. They map to
`suite/tests/scheduled-publish.test.ts`, which has 5 cases with the same names
in the same order. Framework differences live in
`suite/drivers/ext/scheduled-publish.ts`.

The hidden test gets a fresh database for each case. Here one database serves
the whole file. No case counts rows globally, so nothing structural changed.
Titles and search keywords carry a run-unique suffix (`Zephyr<run>`,
`Quokka<run>`). The file creates 6 posts in all, so every post a case looks
for is on the first list page (newest first, 10 per page on both apps). The
test reads page 1 only, as the hidden test does.

| hidden case | suite case | differences |
|---|---|---|
| stores a future publishAt ... others and guests get 404 | same | Rows are read through `driver.sql` on `posts` (`id, title, author_id, published_at`) by title, as `_scheduled-db.ts` does. The guest is a fresh client. Page statuses come from `driver.page` (Inertia JSON / VoidPages JSON); 404 is required for the guest and for another user. The author's page must be 200 and the post-page component (`posts/Show` / `posts/[id]`), with `post.publishedAt` at the same instant. |
| leaves a scheduled post out of the list ... lists it with its date for its author | same | The list is read with `driver.page('/posts')`, and the component is checked (`posts/Index` / `posts`). |
| leaves a scheduled post out of search ... | same | Search goes through the ext's `searchData`. On Guren it is `QUERY /posts/search` `{keywords:[kw]}`, sent through `driver.mutate` so it carries the CSRF header the generated client sends; the response is JSON `{data}`. On Void it is `GET /posts?q=kw` through `driver.page`, using the page's `data`. |
| makes a post public once its published_at has passed | same | `UPDATE posts SET published_at = ? WHERE id = ?` through `driver.sql`, an hour in the past. The running Void dev server sees the write at once. Then the guest's page (200), the guest's list, the guest's search, and a new user's list. |
| rejects an unparsable publishAt the way an invalid title is rejected | same | The hidden test requires the empty-title status to be 4xx. The suite instead requires the empty-title response to be the framework's validation rejection, with `errors` naming `title` (Guren 422 JSON, Void 200 page data). Each bad `publishAt` (`next tuesday`, `2026-13-45T25:61:00Z`) must then answer with the same status, with `errors` naming `publishAt`, and no row with that title may exist. The hidden test checks the `publishAt` key only when the status is 422. Here it is checked on both arms, which on Guren is the same condition. |

`minutesFromNow` (whole minutes, a day ahead) and `expectSameInstant` (compare
`Date.parse`) are copied unchanged. There are no `Bun.sleep` calls in the
original and none here.

Not ported: `hidden/scheduled-command.test.ts`, removed with the report (see
above). Nothing else was left out.

## Void reference (`reference.void.patch`)

- `db/schema.ts` gets `publishedAt: text("published_at")`, nullable. The
  migration comes from `npx void db generate` and is a single
  `ALTER TABLE posts ADD published_at text`.
- `lib/validators.ts` gets `publishAt: z.iso.datetime({ offset: true }).nullish()`
  on `postPayloadSchema`. Because the rule sits on the action's body
  validator, a bad date is refused exactly like an empty title, with the
  error on `publishAt`.
- `lib/posts.ts`:
  - `selectPosts` carries `publishedAt`, so list, show and edit all expose it.
  - `visibleTo(viewerId)` is one visibility condition: `published_at IS NULL`
    or `<= now` (ISO strings), or the viewer is the author.
  - `postAttributes(body)` maps `publishAt` to the column, normalized with
    `toISOString()` so string comparison stays time order.
  - `findPostOrFail(id, viewerId)` applies `visibleTo`, so a scheduled post is
    a 404 on its page, its edit page and its update/delete actions for anyone
    but its author.
- `pages/posts/index.server.ts` ANDs `visibleTo(getUser()?.id)` onto the
  keyword group for both the count and the rows. This covers the list and its
  `?q=` search. The create action stores `postAttributes(body)`.
- `pages/posts/[id].server.ts` and `[id]/edit.server.ts` pass the viewer. The
  update action stores `postAttributes(body)`, so a missing or `null`
  `publishAt` clears the date.
- Pages:
  - `src/components/PublishAtField.tsx` is a `datetime-local` input that holds
    an ISO UTC value, or `null`.
  - The create and edit forms use it, with the edit form prefilled.
  - The list and the post page show "scheduled for …" to the author.
- `pnpm typecheck` passes.

## Validation

`LOGDIR=/tmp/sp-logs-guren SUITE_PORT=4151 RUNS=2 bash suite/validate-guren.sh scheduled-publish` and
`LOGDIR=/tmp/sp-logs-void SUITE_PORT=4251 RUNS=2 bash suite/validate-void.sh scheduled-publish`:

| arm | state | run 1 | run 2 |
|---|---|---|---|
| Guren (port 4151) | start (0fd1654 + `bun update`) | FAIL 0/5 | FAIL 0/5 |
| Guren | start + agents-on-guren `reference.patch` | PASS 5/5 | PASS 5/5 |
| Void (port 4251) | start | FAIL 0/5 | FAIL 0/5 |
| Void | start + `reference.void.patch` | PASS 5/5 | PASS 5/5 |

On both start states:

- Cases 1-4 fail at the first `driver.sql` read, with "no such column:
  published_at".
- Case 5 fails because the unknown `publishAt` is dropped and the post is
  saved (Guren answers 303 where 422 was expected).
- The helpers themselves pass on the reference runs: the Guren `QUERY
  /posts/search` through `mutate` gets 200 with no CSRF rejection, and the
  component checks pass.

Logs are in `/tmp/sp-logs-guren/` and `/tmp/sp-logs-void/`.

Breaking the Void reference (one edit each, one `run.sh` run each):

1. Author exception removed from `visibleTo` (always public-only): 3 pass, 2 fail. The failing cases are "shows the post page to its author only" and "lists it with its date for its author".
2. Visibility filter dropped from the list loader (`where = and(search)`): 2 pass, 3 fail (list, search, and "public once its published_at has passed", whose first check is that the guest's list does not show the post yet).
3. Validator loosened to `z.string().nullish()`: 4 pass, 1 fail ("rejects an unparsable publishAt").

`pnpm typecheck` passes on the reference copy.

## Arm (in)equality

- **Search is cheaper on Void.** On the Void app, list and search are one
  loader (`/posts` with `?q=`), so a single visibility filter covers both. On
  Guren, `index`, `show` and `search` are three controller actions, and
  keeping the visibility rule consistent across all three is the ticket's main
  trap: its `harness_signal` says nothing in check or audit notices a rule
  applied to one action and forgotten on another. On Void that trap shrinks to
  two places, the list loader and the post loader. The Guren arm is graded on
  one more place where the rule can be forgotten.
- **ORing past the keyword group.** Both arms keep this trap. On Void, an
  `or(..., eq(authorId))` placed beside the keyword `or(...)` rather than
  inside an `and` would leak other users' posts into the list and search
  alike.
- **The report** is removed from both arms, so neither does that work.
- Everything else matches: a column and a migration, a validator field,
  storing a normalized ISO string, the author exception on the page and the
  list, and the form fields.
