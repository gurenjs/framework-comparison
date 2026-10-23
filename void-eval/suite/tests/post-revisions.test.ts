// Port of agents-on-guren tasks/post-revisions/hidden/post-revisions.test.ts
//
// The ticket pins the table `post_revisions` (id, post_id, title, excerpt,
// body, created_at), `GET /posts/:id/revisions` with `revisions: [{ id,
// title, createdAt }]` newest first in its page data, and `POST
// /posts/:id/revisions/:revisionId/restore` redirecting to `/posts/:id`.
// Revision rows and post content are read by table name through driver.sql.
//
// The hidden test gets a fresh database per file and inserts posts with
// `makePost`; here posts are created through the create form (which also
// checks "creating a post keeps nothing"). Every assertion is scoped to the
// posts a case creates, so sharing one database across the file changes
// nothing.
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Client, Driver, Id } from '../drivers/types.ts'
import { restoreRevision, revisionsPage, revisionsPlainGet, submitUpdate, type PostContent } from '../drivers/ext/post-revisions.ts'
import { makeUser } from '../lib/fixtures.ts'

interface RevisionProp {
  id: Id
  title: string
  createdAt: string
}

interface RevisionRow {
  id: number
  post_id: number
  title: string
  excerpt: string
  body: string
  created_at: string
}

// Each edit pair sleeps over a second; the cross-post case makes three pairs
// plus three sign-ups. The hidden test allows 20 s in-process; over HTTP
// against a dev server the margin is wider.
const TIMEOUT_MS = 60_000

const ORIGINAL = { title: 'First title', excerpt: 'First excerpt', body: 'First body.' }
const SECOND = { title: 'Second title', excerpt: 'Second excerpt', body: 'Second body.' }
const THIRD = { title: 'Third title', excerpt: 'Third excerpt', body: 'Third body.' }

function contentOf(post: PostContent | null | undefined) {
  return post == null ? null : { title: post.title, excerpt: post.excerpt, body: post.body }
}

describe('post revisions', () => {
  let driver: Driver

  beforeAll(() => {
    driver = loadDriver()
  })

  function revisionRows(postId: Id): RevisionRow[] {
    return driver.sql<RevisionRow>(
      'SELECT id, post_id, title, excerpt, body, created_at FROM post_revisions WHERE post_id = ? ORDER BY id',
      [postId],
    )
  }

  /** The post's current content straight from `posts` (stands in for `Post.find`); null when the row is gone. */
  function postContent(postId: Id) {
    const rows = driver.sql<PostContent>('SELECT title, excerpt, body FROM posts WHERE id = ?', [postId])
    return rows.length === 1 ? contentOf(rows[0]) : null
  }

  /** Create a post through the create form (stands in for `makePost`). */
  async function makePost(client: Client, content: PostContent): Promise<Id> {
    const { id } = await driver.createPost(client, content)
    return id
  }

  /** Edit `postId` twice as its author (First → Second → Third), leaving two revisions. */
  async function editTwice(client: Client, postId: Id) {
    const first = await submitUpdate(driver, client, postId, SECOND)
    expect([302, 303], `status ${first.status}: ${first.bodyText.slice(0, 300)}`).toContain(first.status)
    // Over a second apart, so "newest first" is not a tie whether a solution
    // orders by id or by a created_at stored at millisecond or second precision.
    await Bun.sleep(1100)
    const second = await submitUpdate(driver, client, postId, THIRD)
    expect([302, 303], `status ${second.status}: ${second.bodyText.slice(0, 300)}`).toContain(second.status)
  }

  async function revisionsProps(client: Client, postId: Id): Promise<RevisionProp[]> {
    const page = await revisionsPage(driver, client, postId)
    expect(page.status).toBe(200)
    expect(Array.isArray(page.props?.revisions)).toBe(true)
    return page.props!.revisions as RevisionProp[]
  }

  it('keeps the previous version on every edit and lists revisions newest first', async () => {
    const author = await makeUser(driver, { tag: 'reviser' })
    const postId = await makePost(author.client, ORIGINAL)
    const client = author.client

    expect(revisionRows(postId)).toHaveLength(0)
    await editTwice(client, postId)

    const rows = revisionRows(postId)
    expect(rows).toHaveLength(2)
    expect(rows.map(contentOf)).toEqual(expect.arrayContaining([ORIGINAL, SECOND]))

    const revisions = await revisionsProps(client, postId)
    expect(revisions).toHaveLength(2)
    expect(revisions.map((revision) => revision.title)).toEqual([SECOND.title, ORIGINAL.title])
    for (const revision of revisions) {
      expect(rows.map((row) => Number(row.id))).toContain(Number(revision.id))
      expect(rows.find((row) => Number(row.id) === Number(revision.id))?.title).toBe(revision.title)
      expect(typeof revision.createdAt).toBe('string')
      expect(Number.isNaN(Date.parse(revision.createdAt))).toBe(false)
    }
  }, TIMEOUT_MS)

  it('restores a revision, redirects to the post, and keeps the pre-restore state as a revision', async () => {
    const author = await makeUser(driver, { tag: 'reviser' })
    const postId = await makePost(author.client, ORIGINAL)
    const client = author.client
    await editTwice(client, postId)

    const original = revisionRows(postId).find((row) => row.title === ORIGINAL.title)
    expect(original).toBeDefined()

    const res = await restoreRevision(driver, client, postId, original!.id)
    expect([302, 303], `status ${res.status}: ${res.bodyText.slice(0, 300)}`).toContain(res.status)
    expect(res.location).toBe(`/posts/${postId}`)

    expect(postContent(postId)).toEqual(ORIGINAL)
    const rows = revisionRows(postId)
    expect(rows).toHaveLength(3)
    expect(rows.map(contentOf)).toEqual(expect.arrayContaining([ORIGINAL, SECOND, THIRD]))
  }, TIMEOUT_MS)

  it('refuses another signed-in user with 403, both for the list and for a restore', async () => {
    const author = await makeUser(driver, { tag: 'reviser' })
    const other = await makeUser(driver, { tag: 'intruder' })
    const postId = await makePost(author.client, ORIGINAL)
    await editTwice(author.client, postId)
    const revision = revisionRows(postId)[0]!

    const list = await revisionsPage(driver, other.client, postId)
    expect(list.status).toBe(403)

    const restore = await restoreRevision(driver, other.client, postId, revision.id)
    expect(restore.status, restore.bodyText.slice(0, 300)).toBe(403)
    expect(postContent(postId)).toEqual(THIRD)
    expect(revisionRows(postId)).toHaveLength(2)
  }, TIMEOUT_MS)

  it('sends a guest to the login page, both for the list and for a restore', async () => {
    const author = await makeUser(driver, { tag: 'reviser' })
    const postId = await makePost(author.client, ORIGINAL)
    await editTwice(author.client, postId)
    const revision = revisionRows(postId)[0]!

    const guest = driver.newClient()
    const list = await revisionsPlainGet(driver, guest, postId)
    expect([302, 303], `status ${list.status}`).toContain(list.status)
    expect(list.location).toBe('/login')

    const restore = await restoreRevision(driver, guest, postId, revision.id)
    expect([302, 303], `status ${restore.status}: ${restore.bodyText.slice(0, 300)}`).toContain(restore.status)
    expect(restore.location).toBe('/login')
    expect(postContent(postId)).toEqual(THIRD)
    expect(revisionRows(postId)).toHaveLength(2)
  }, TIMEOUT_MS)

  it('answers 404 for a revision id that belongs to another post, and changes nothing', async () => {
    const author = await makeUser(driver, { tag: 'reviser' })
    const client = author.client
    const target = await makePost(client, ORIGINAL)
    const sibling = await makePost(client, { title: 'Sibling title', excerpt: 'Sibling excerpt', body: 'Sibling body.' })
    await editTwice(client, target)
    await editTwice(client, sibling)
    const siblingRevision = revisionRows(sibling)[0]!

    // Same author owns both posts, so only the post/revision mismatch can refuse this.
    const res = await restoreRevision(driver, client, target, siblingRevision.id)
    expect(res.status, res.bodyText.slice(0, 300)).toBe(404)
    expect(postContent(target)).toEqual(THIRD)
    expect(revisionRows(target)).toHaveLength(2)
    expect(revisionRows(sibling)).toHaveLength(2)

    // Another user's revision must never be copied onto the author's post either.
    const stranger = await makeUser(driver, { tag: 'stranger' })
    const theirs = await makePost(stranger.client, { title: 'Stranger title', excerpt: 'Stranger excerpt', body: 'Stranger body.' })
    await editTwice(stranger.client, theirs)
    const theirRevision = revisionRows(theirs)[0]!
    const crossUser = await restoreRevision(driver, client, target, theirRevision.id)
    expect([403, 404]).toContain(crossUser.status)
    expect(postContent(target)).toEqual(THIRD)
    expect(revisionRows(target)).toHaveLength(2)
  }, TIMEOUT_MS)

  it("removes a post's revisions when the post is deleted", async () => {
    const author = await makeUser(driver, { tag: 'reviser' })
    const client = author.client
    const postId = await makePost(client, ORIGINAL)
    const kept = await makePost(client, ORIGINAL)
    await editTwice(client, postId)
    await editTwice(client, kept)
    expect(revisionRows(postId)).toHaveLength(2)

    const res = await driver.deletePost(client, postId)
    expect(res.ok, `status ${res.status}: ${res.bodyText.slice(0, 300)}`).toBe(true)
    expect(postContent(postId)).toBeNull()
    expect(revisionRows(postId)).toHaveLength(0)
    expect(revisionRows(kept)).toHaveLength(2)
  }, TIMEOUT_MS)
})
