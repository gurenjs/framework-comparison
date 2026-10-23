// Port of agents-on-guren tasks/comments-moderation/hidden/comments-moderation.test.ts
// (8 cases, the same as the hidden test). Framework differences live in
// drivers/ext/comments-moderation.ts.
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Driver, Id } from '../drivers/types.ts'
import { makeUser, postFixture, type TestUser } from '../lib/fixtures.ts'
import {
  commentById,
  commentByBody,
  commentsOnPost,
  deleteComment,
  postComment,
  postPage,
  postPageComponent,
  reportComment,
  reportCount,
  userId,
  type CommentProp,
} from '../drivers/ext/comments-moderation.ts'

let seq = 0
const uniqueBody = (label: string) => `${label} #${++seq} ${Date.now()}`

describe('comments on posts, with community moderation', () => {
  let driver: Driver

  beforeAll(() => {
    driver = loadDriver()
  })

  const makePost = async (author: TestUser) => (await driver.createPost(author.client, postFixture(uniqueBody('post')))).id

  /** The post page's comments (page data / Inertia props), asserting the page is a 200 page object. */
  async function pageComments(postId: Id): Promise<{ component: string | null; comments: CommentProp[] | undefined }> {
    const page = await postPage(driver, driver.newClient(), postId)
    expect(page.status).toBe(200)
    return { component: page.component, comments: page.props?.comments as CommentProp[] | undefined }
  }

  /** Post a comment as `user` through the pinned route and return its stored row. */
  async function comment(user: TestUser, postId: Id, body = uniqueBody('A comment')) {
    const res = await postComment(driver, user.client, postId, body)
    expect([302, 303]).toContain(res.status)
    const row = commentByBody(driver, body)
    expect(row).toBeDefined()
    return row!
  }

  it('sends a guest who tries to comment to /login and stores nothing', async () => {
    const author = await makeUser(driver, { tag: 'author' })
    const postId = await makePost(author)

    const res = await postComment(driver, driver.newClient(), postId, 'Guest comment')
    expect([302, 303]).toContain(res.status)
    expect(res.location ?? '').toMatch(/\/login$/)
    expect(commentsOnPost(driver, postId)).toHaveLength(0)
  })

  it("stores a signed-in user's comment on someone else's post and lists it on the post page with its author, oldest first", async () => {
    const a = await makeUser(driver, { tag: 'a' })
    const b = await makeUser(driver, { name: 'Bea Commenter', tag: 'b' })
    const c = await makeUser(driver, { name: 'Cal Commenter', tag: 'c' })
    const postId = await makePost(a)

    const first = uniqueBody('First!')
    const res = await postComment(driver, b.client, postId, first)
    expect([302, 303]).toContain(res.status)
    expect(res.location ?? '').toMatch(new RegExp(`/posts/${postId}$`))

    const rows = commentsOnPost(driver, postId)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.user_id).toBe(userId(driver, b))
    expect(rows[0]!.body).toBe(first)

    // A gap, so an implementation ordering by created_at alone cannot tie.
    await Bun.sleep(15)
    const second = (await comment(c, postId, uniqueBody('Second'))).body

    const { component, comments } = await pageComments(postId)
    expect(component).toBe(postPageComponent(driver))
    expect(Array.isArray(comments)).toBe(true)
    expect(comments!.map((entry) => entry.body)).toEqual([first, second])

    const shown = comments![0]!
    expect(shown.id).toBe(rows[0]!.id)
    expect(shown.author).toMatchObject({ id: userId(driver, b), name: 'Bea Commenter' })
    expect(typeof shown.createdAt).toBe('string')
    expect(Number.isNaN(Date.parse(shown.createdAt))).toBe(false)
  })

  it('lets the author of a comment delete it', async () => {
    const a = await makeUser(driver, { tag: 'a' })
    const b = await makeUser(driver, { tag: 'b' })
    const postId = await makePost(a)
    const row = await comment(b, postId)

    const res = await deleteComment(driver, b.client, row.id, postId)
    expect([302, 303]).toContain(res.status)
    expect(res.location ?? '').toMatch(new RegExp(`/posts/${postId}$`))
    expect(commentById(driver, row.id)).toBeUndefined()
  })

  it("lets the post's author delete someone else's comment on it", async () => {
    const a = await makeUser(driver, { tag: 'a' })
    const b = await makeUser(driver, { tag: 'b' })
    const postId = await makePost(a)
    const row = await comment(b, postId)

    const res = await deleteComment(driver, a.client, row.id, postId)
    expect([302, 303]).toContain(res.status)
    expect(commentById(driver, row.id)).toBeUndefined()
  })

  it('refuses a user who wrote neither the comment nor the post with 403 and keeps the comment', async () => {
    const a = await makeUser(driver, { tag: 'a' })
    const b = await makeUser(driver, { tag: 'b' })
    const c = await makeUser(driver, { tag: 'c' })
    const postId = await makePost(a)
    const row = await comment(b, postId)

    const res = await deleteComment(driver, c.client, row.id, postId)
    expect(res.status).toBe(403)
    expect(commentById(driver, row.id)).toBeDefined()
  })

  it('hides a comment reported by three different users from the post page and keeps it in the database', async () => {
    const a = await makeUser(driver, { tag: 'a' })
    const b = await makeUser(driver, { tag: 'b' })
    const postId = await makePost(a)
    const hidden = await comment(b, postId, uniqueBody('Spam'))
    const kept = await comment(b, postId, uniqueBody('Fine'))

    const reporters = [await makeUser(driver, { tag: 'r1' }), await makeUser(driver, { tag: 'r2' })]
    for (const reporter of reporters) {
      expect((await reportComment(driver, reporter.client, hidden.id)).status).toBe(204)
    }
    // Two reports are not enough.
    let page = await pageComments(postId)
    expect(page.comments!.map((entry) => entry.id)).toContain(hidden.id)

    const third = await makeUser(driver, { tag: 'r3' })
    expect((await reportComment(driver, third.client, hidden.id)).status).toBe(204)
    expect(reportCount(driver, hidden.id)).toBe(3)

    page = await pageComments(postId)
    const ids = page.comments!.map((entry) => entry.id)
    expect(ids).not.toContain(hidden.id)
    expect(ids).toContain(kept.id)
    expect(commentById(driver, hidden.id)).toBeDefined()
  })

  it('records one report when the same user reports a comment twice, answering 204 both times', async () => {
    const a = await makeUser(driver, { tag: 'a' })
    const b = await makeUser(driver, { tag: 'b' })
    const reporter = await makeUser(driver, { tag: 'r' })
    const postId = await makePost(a)
    const row = await comment(b, postId)

    expect((await reportComment(driver, reporter.client, row.id)).status).toBe(204)
    expect((await reportComment(driver, reporter.client, row.id)).status).toBe(204)
    expect(reportCount(driver, row.id, userId(driver, reporter))).toBe(1)
    expect(reportCount(driver, row.id)).toBe(1)
  })

  it('removes a post’s comments when the post is deleted', async () => {
    const a = await makeUser(driver, { tag: 'a' })
    const b = await makeUser(driver, { tag: 'b' })
    const postId = await makePost(a)
    await comment(b, postId)
    await comment(a, postId)
    expect(commentsOnPost(driver, postId)).toHaveLength(2)

    const res = await driver.deletePost(a.client, postId)
    expect(res.ok).toBe(true)
    expect(commentsOnPost(driver, postId)).toHaveLength(0)
  })
})
