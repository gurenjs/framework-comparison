# Hidden-defect seeds (tasks/*-authz)

Round 3 asks whether a framework's verification catches a defect the ticket
never mentions. The seed was chosen by these rules, written down before any
cell ran:

1. **A defect both frameworks can have, in the same place.** Both apps
   authorize a post's update in its action (Guren `PostController.update`:
   `this.authorize('update', [Post, post])`; Void `pages/posts/[id].server.ts`
   `actions.update`: `authorizeAuthor(user, post)`). The seed deletes that one
   line in each (`update-authz.guren.patch`, `update-authz.void.patch`). It is
   not a defect class only one framework's design creates (as an unmounted
   Guren routes file was in round 1).
2. **In code the ticket must change.** post-tags, post-revisions and
   scheduled-publish all edit the update action, so an agent of either arm
   reads the defective code while doing the ticket.
3. **Visible to a careful reader without tools.** The delete action right next
   to it still authorizes; the post's edit page still refuses other users.
4. **Graded by a framework-neutral HTTP check**
   (`suite/lib/update-authz.ts`): another user's edit must be refused (403 or
   404) and leave the post unchanged. The task's own graded tests are
   unchanged.
5. **Statement unchanged.** The ticket text is the Stage 2 text; it never
   names the defect.

**What favours Guren, stated up front:** Guren ships a static check for this
class (`guren audit`, rule A01 "mutating route with a policy and no
authorization"), and harness v4 is the change that makes that check reach the
agent. Void ships no equivalent. That asymmetry is the hypothesis under test
("Guren's verification catches defects Void's does not"), not a property of
the seed. A seed outside every detector Guren has would test the agents, not
the verification.

Validation: for each task and arm, seeded start + reference (feature and fix)
passes the graded test and the defect check, and seeded start + the reference
without the fix passes the graded test and fails the defect check
(`logs/validate-authz-tasks-2026-10-19.log`).

## Round 4: more defect classes, and controls (2026-10-20)

Round 3 tested one class Guren has a detector for. Round 4 adds a second such
class and two classes no Guren check reads, so a difference that shows only
where Guren has a detector reads as the detector, not as Guren agents being
more careful. The same rules 1–5 apply to each. Every seed is the same change
in both apps.

| seed | what it removes or adds | tickets | does any Guren check read it? |
|---|---|---|---|
| `update-authz` (round 3) | the author check in the post update action | post-tags, post-revisions, scheduled-publish | yes: `guren audit` A01 on a mutating route, sent to the agent by harness v4 |
| `destroy-authz` | the author check in the post delete action | post-tags, post-revisions, comments-moderation (each changes what deleting a post does) | yes: the same A01 rule |
| `edit-authz` | the author check on the edit page (`GET /posts/:id/edit`) | post-tags, scheduled-publish (each changes the edit form) | **no**: A01 reads mutating routes only (checked: `guren audit` on the seeded app reports nothing for it) |
| `mass-assign` | `authorId` accepted by the post payload schema and, in Guren, listed in `fillable` (Guren's two comments saying the author never comes from the request are removed too, since the Void app has no such comment) | post-tags (it changes the update path) | **no**: `guren audit` only reports a model with no `fillable` |

Checks (`suite/lib/*.ts`): another user's delete is refused and the post stays
(`destroy-authz.ts`); another user cannot open the edit page (`edit-authz.ts`);
an edit sending another `authorId` leaves the author unchanged
(`mass-assign.ts`).

**Dropped after validation: `post-revisions-mass`.** The Void reference for
post-revisions rewrites the update to set named columns, so without the fix
it already passes the check: the defect disappears in a natural
implementation of the ticket, and the check would grade the implementation
style, not the agent's catch.

**Not used: an OR condition that leaks past an AND filter in search.** The
same defect cannot be written in both apps. Drizzle's `or()`, which the Void
app's search uses, always parenthesizes, while Guren's query builder chains
`where().orWhere()` without grouping. A seed would be a Guren-only defect class,
the kind round 1's unmounted routes file was.
