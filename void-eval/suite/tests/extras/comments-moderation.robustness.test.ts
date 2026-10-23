// Robustness extra (not graded): what the statement asks for beyond the graded
// cases. "Endpoints, all for signed-in users; a guest gets the same redirect",
// "the body must be 1 to 2000 characters; anything else fails ... and stores
// nothing", "the comment's author is the signed-in user", and no 5xx on ids
// that do not exist.
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../../drivers/index.ts'
import type { Driver } from '../../drivers/types.ts'
import { makeUser, postFixture } from '../../lib/fixtures.ts'
import { isGuestRefusal, isServerError, isValidationRefusal } from '../../lib/robust.ts'
import { commentByBody, commentsOnPost, deleteComment, postComment, reportComment, reportCount, userId } from '../../drivers/ext/comments-moderation.ts'

let seq = 0
const unique = (label: string) => `${label} ~${++seq} ${Date.now()}`

describe('comments: robustness (extra)', () => {
  let driver: Driver
  beforeAll(() => {
    driver = loadDriver()
  })

  it('refuses an empty and a 2001-character body as invalid input and stores nothing', async () => {
    const author = await makeUser(driver, { tag: 'rb-author' })
    const { id: postId } = await driver.createPost(author.client, postFixture(unique('post')))
    for (const body of ['', 'x'.repeat(2001)]) {
      const res = await postComment(driver, author.client, postId, body)
      expect(isValidationRefusal(res), `body length ${body.length}: ${res.status} ${res.bodyText.slice(0, 200)}`).toBe(true)
    }
    expect(commentsOnPost(driver, postId)).toHaveLength(0)
  })

  it('accepts a 2000-character body', async () => {
    const author = await makeUser(driver, { tag: 'rb-author' })
    const { id: postId } = await driver.createPost(author.client, postFixture(unique('post')))
    const body = 'y'.repeat(1990) + String(Date.now()).slice(-10)
    const res = await postComment(driver, author.client, postId, body)
    expect([302, 303]).toContain(res.status)
    expect(commentByBody(driver, body)).toBeDefined()
  })

  it('records the signed-in user as the author even when the request names another user', async () => {
    const a = await makeUser(driver, { tag: 'rb-a' })
    const b = await makeUser(driver, { tag: 'rb-b' })
    const { id: postId } = await driver.createPost(a.client, postFixture(unique('post')))
    const body = unique('spoof')
    const path = driver.name === 'void' ? `/posts/${postId}?comment` : `/posts/${postId}/comments`
    const res = await driver.mutate(b.client, 'POST', path, { body, user_id: userId(driver, a), userId: userId(driver, a), authorId: userId(driver, a) })
    expect(isServerError(res)).toBe(false)
    const row = commentByBody(driver, body)
    if (row) expect(row.user_id).toBe(userId(driver, b))
  })

  it("sends a guest who deletes or reports a comment to the login page and changes nothing", async () => {
    const a = await makeUser(driver, { tag: 'rb-a' })
    const { id: postId } = await driver.createPost(a.client, postFixture(unique('post')))
    const body = unique('keep me')
    await postComment(driver, a.client, postId, body)
    const row = commentByBody(driver, body)!
    const guest = driver.newClient()
    const del = await deleteComment(driver, guest, row.id, postId)
    expect(isGuestRefusal(del), `delete: ${del.status} ${del.location}`).toBe(true)
    const rep = await reportComment(driver, guest, row.id)
    expect(isGuestRefusal(rep), `report: ${rep.status} ${rep.location}`).toBe(true)
    expect(commentByBody(driver, body)).toBeDefined()
    expect(reportCount(driver, row.id)).toBe(0)
  })

  it('answers a comment on a missing post, and a delete or report of a missing comment, without a server error', async () => {
    const u = await makeUser(driver, { tag: 'rb-u' })
    const missingPost = 99_999_999
    const c = await postComment(driver, u.client, missingPost, unique('orphan'))
    expect(isServerError(c), `comment: ${c.status}`).toBe(false)
    expect(driver.sql('SELECT id FROM comments WHERE post_id = ?', [missingPost])).toHaveLength(0)
    const d = await deleteComment(driver, u.client, 99_999_999, 1)
    expect(isServerError(d), `delete: ${d.status}`).toBe(false)
    const r = await reportComment(driver, u.client, 99_999_999)
    expect(isServerError(r), `report: ${r.status}`).toBe(false)
  })
})
