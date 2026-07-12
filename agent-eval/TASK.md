# Task: add tags to posts

Implement a tag feature in this application. Follow the project's existing
conventions, file layout, and code style throughout.

## Requirements

1. **Data model**: posts can have multiple tags (many-to-many). Add a `tags`
   table (unique `name`) and a `post_tags` join table, with the appropriate
   migration(s).
2. **Tagging on create/edit**: the post create and edit forms gain a "Tags"
   text field accepting comma-separated tag names (e.g. `bun, webdev`).
   On save, tags are created if they don't exist yet and associated with the
   post; removed names are disassociated on edit.
3. **Display**: the post show page and each entry on the posts list show the
   post's tags.
4. **Filtering**: the posts list accepts a `?tag=<name>` query parameter and
   then shows only posts carrying that tag (pagination may reset to page 1).
   Tags shown in the list/show pages link to the filtered list.
5. **Validation** (server-side): each tag name is 1–30 characters after
   trimming; at most 5 tags per post. Invalid input re-renders the form with
   an error message, like the existing fields do.
6. **Tests**: add tests for tagging and filtering in the project's existing
   test style. All existing tests and the typecheck must still pass.

## Definition of done

- Typecheck passes.
- The full test suite (existing + new) passes.

That is the whole definition — you do NOT need to boot the app or verify the
feature over HTTP; functional acceptance is checked externally afterwards.
