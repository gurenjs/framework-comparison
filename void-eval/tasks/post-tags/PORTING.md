# Porting notes: post-tags

Source: `agents-on-guren/tasks/post-tags` (statement.md, hidden/post-tags.test.ts,
reference.patch). Ported files:

| file | what it is |
|---|---|
| `task.json` | stage 2, 200 turns |
| `statement.guren.md` | verbatim copy of the agents-on-guren `statement.md` |
| `statement.void.md` | the same ticket for the Void app (changes below) |
| `reference.void.patch` | the Void solution, `git diff` from the app root |
| `../../suite/tests/post-tags.test.ts` | the shared black-box test |
| `../../suite/drivers/ext/post-tags.ts` | the per-framework helpers the test uses |

## Statement changes (Guren -> Void)

Product text, rules, the pinned contract (tables `tags`/`post_tags` and their
columns, field `tags`, parameter `tag`, `tags: string[]` sorted, `[]` when
none) and the six acceptance items are the same. Only these lines differ:

1. **Contract, page data.** "the posts list page (`posts/Index`, its `data`
   prop) and the post page (`posts/Show`, its `post` prop)" became "the posts
   list page's data (`/posts`, its `data`) and the post page's data
   (`/posts/:id`, its `post`)". Void pages have no Inertia component names
   or props; the loader's return value is the page data.
2. **Acceptance item 1.** "the post page's `post.tags` is" became "the post
   page's data has `post.tags`", the same wording change as (1).
3. **Acceptance item 4.** "refused with the same status an empty title gets
   today" became "refused with the same response an empty title gets today
   (the error on `tags`)". On Void, an empty title is a 200 page response whose
   `errors` names the field, not an error status, so "status" would read as a
   hint that some error status is expected. The rules section of both
   statements already says "same response, the error reported on the `tags`
   field"; item 4 now repeats that.

Not changed on purpose: the edit URL is not named in either statement (the
Guren one does not name `PUT /posts/:id` either), and no Void API is named
(no `withValidator`, `ValidationError`, `db.batch`, `onConflictDoNothing`,
`void db generate`). The Guren statement does not mention CSRF, Inertia or
`bun run`, so there was nothing else to translate. User ids do not appear.
"drives the app in-process" is kept verbatim (as in the comments-moderation
port) although the suite drives both apps over HTTP; it only describes the
harness and is identical for both arms.

## Hidden test -> suite test

The hidden test gets a fresh database per case (`freshApp()`); the suite boots
once per file, so one database serves all six cases. Global assertions became
before/after comparisons that are just as exact: the request may add exactly
the expected rows and nothing else.

| hidden case | suite case | differences |
|---|---|---|
| stores "bun, webdev" … post page shows them | same name | `tagNames() == ['bun','webdev']` became `tagNames() == before ∪ {bun, webdev}` (the whole `tags` table, sorted). Post page read as a guest through `driver.page`; component checked (`posts/Show` / `posts/[id]`). |
| editing the field down to "bun" … | same name | update sent through `submitUpdate` (Guren `PUT /posts/:id`, Void `PUT /posts/:id?update`), 302/303 required. |
| ?tag=bun lists only … | same name | Tag names are run-unique (`bun-<run>`, `webdev-<run>`) instead of `bun`/`webdev`, because cases 1 and 2 already attached `bun` to other posts; the filtered list must still be exactly `[bunPost]` with `total 1`. The untagged post is created through the form with no `tags` key (the hidden test inserts it with `makePost`), which also covers "leaving the field out means no tags". Adds: every post on the unfiltered page has an array `tags`. |
| rejects six tags … saves nothing | same name | `countRows('tags') == 0` / `countRows('post_tags') == 0` became "the `tags` table and the `post_tags` count are unchanged". The title comparison: the hidden test requires the empty-title status to be 422; the suite requires `validationStatus(driver)` (Guren 422, Void 200) and `errors.title`, then the tags request must answer with the same status and an `errors` key starting with `tags`, and no post with that title may exist. |
| rejects a 31-character tag name … 30 accepted | same name | `post_tags` count unchanged instead of 0. |
| collapses " bun ,bun" … | same name | `tagNames() == ['bun']` became `tagNames() == before ∪ {bun}`; `countRows('post_tags') == 1` became "+1", plus `tagsOfPost(id) == ['bun']`. |

Nothing was left unported. DB reads use the pinned table names only
(`tags`, `post_tags`) plus `posts.title`/`posts.id`, through `driver.sql`.

## Void reference (`reference.void.patch`)

- `db/schema.ts`: `tags` (`id`, `name` unique) and `post_tags` (`post_id`,
  `tag_id`, composite primary key, both foreign keys `ON DELETE CASCADE`, so
  deleting a tagged post keeps working); migration from `npx void db generate`.
- `lib/validators.ts`: `tags` on `postPayloadSchema`, a string that defaults to
  `''`, is split/trimmed/deduplicated by a transform, and refined to at most 5
  names of at most 30 characters. Because the rule lives on the action's body
  validator (`withValidator`), a bad tag list is refused exactly like an empty
  title, with the error on `tags`.
- `lib/tags.ts`: `syncPostTags` (insert unknown names with
  `onConflictDoNothing`, then replace the post's pivot rows in one
  `db.batch`, as the D1 docs recommend in place of a transaction),
  `withTags` (one extra query for the page's post ids, names sorted),
  `postIdsTagged` (subquery for the `?tag=` filter).
- Pages: list loader filters on `tag` (count and rows), returns `tag` so page
  links keep it; create/update actions sync tags; show and edit loaders add
  `tags`; create/edit forms get a Tags input (edit prefilled with
  `tags.join(", ")`); `src/components/TagLinks.tsx` links each tag to
  `/posts?tag=<name>` (no `page`, so page 1).
- `pnpm typecheck` passes.

## Validation

`SUITE_PORT=4111 RUNS=2 bash suite/validate-guren.sh post-tags` and
`SUITE_PORT=4211 RUNS=2 bash suite/validate-void.sh post-tags`:

| arm | state | run 1 | run 2 |
|---|---|---|---|
| Guren | start (0fd1654 + `bun update`) | FAIL 0/6 | FAIL 0/6 |
| Guren | start + agents-on-guren `reference.patch` | PASS 6/6 | PASS 6/6 |
| Void | start | FAIL 0/6 | FAIL 0/6 |
| Void | start + `reference.void.patch` | PASS 6/6 | PASS 6/6 |

On both start states the cases fail on the missing `tags`/`post_tags` tables
and on the list's posts having no `tags`. They do not fail inside the helpers:
on the reference runs the empty-title comparison (Guren 422 / Void 200 with
`errors.title`) and the component checks (`posts/Show`, `posts/[id]`) all pass.

Breaking the Void reference (one run each):

- The max-5 refine removed from `tagListSchema`: 5 pass, 1 fail ("rejects six tags").
- The `?tag=` condition dropped from the list loader: 5 pass, 1 fail ("?tag=bun lists only …").

`pnpm typecheck` passes on the reference copy.

## Arm (in)equality

- Both arms do the same product work: two tables plus a migration, a validator
  field, create/update/list/show/edit, and four pages.
- Both arms have a relational read API: Guren has `belongsToMany`, `.with`
  and `whenLoaded`; Void gets Drizzle `relations()` with
  `db.query.*.findMany({ with })`. Neither has anything that writes the pivot
  (no attach or sync).
- The Void reference keeps to the app's existing join style (`selectPosts`).
  It writes the pivot queries by hand (an insert with `onConflictDoNothing`,
  then a `db.batch` of delete and insert) and runs a second query for each
  page's tags. The Guren reference does the same with a `PostTag` join model.
  The work is comparable; neither arm needs an ORM workaround that the other
  does not.
- On both arms, "refused the same way as an empty title" comes free when the
  rule lives in the action's or route's body schema.
