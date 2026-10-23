// Robustness extra (not graded): "an edit that is refused (invalid input, not
// allowed) keeps nothing", and ids that do not exist answer without a 5xx and
// change nothing.
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../../drivers/index.ts'
import type { Driver, Id } from '../../drivers/types.ts'
import { makeUser, postFixture } from '../../lib/fixtures.ts'
import { isServerError } from '../../lib/robust.ts'
import { restoreRevision, revisionsPage, submitUpdate } from '../../drivers/ext/post-revisions.ts'

let seq = 0
const unique = (label: string) => `${label} ~${++seq} ${Date.now()}`

describe('post revisions: robustness (extra)', () => {
  let driver: Driver
  beforeAll(() => {
    driver = loadDriver()
  })

  const revisionCount = (postId: Id) => Number(driver.sql<{ n: number }>('select count(*) as n from post_revisions where post_id = ?', [postId])[0]?.n ?? 0)
  const titleOf = (postId: Id) => driver.sql<{ title: string }>('select title from posts where id = ?', [postId])[0]?.title

  it('keeps no revision for an edit refused as invalid input', async () => {
    const u = await makeUser(driver, { tag: 'rr' })
    const title = unique('Orig')
    const { id } = await driver.createPost(u.client, postFixture(1, { title }))
    const res = await submitUpdate(driver, u.client, id, { title: '', excerpt: 'E', body: 'B' })
    expect([302, 303]).not.toContain(res.status)
    expect(revisionCount(id)).toBe(0)
    expect(titleOf(id)).toBe(title)
  })

  it("keeps no revision for another user's refused edit", async () => {
    const owner = await makeUser(driver, { tag: 'rr-owner' })
    const other = await makeUser(driver, { tag: 'rr-other' })
    const title = unique('Mine')
    const { id } = await driver.createPost(owner.client, postFixture(1, { title }))
    const res = await submitUpdate(driver, other.client, id, { title: unique('Hijack'), excerpt: 'E', body: 'B' })
    expect([302, 303]).not.toContain(res.status)
    expect(revisionCount(id)).toBe(0)
    expect(titleOf(id)).toBe(title)
  })

  it('answers a missing revision, and the revisions of a missing post, without a server error and changes nothing', async () => {
    const u = await makeUser(driver, { tag: 'rr' })
    const title = unique('Stable')
    const { id } = await driver.createPost(u.client, postFixture(1, { title }))
    const r = await restoreRevision(driver, u.client, id, 99_999_999)
    expect(isServerError(r), `restore: ${r.status}`).toBe(false)
    expect([302, 303]).not.toContain(r.status)
    expect(titleOf(id)).toBe(title)
    expect(revisionCount(id)).toBe(0)
    const p = await revisionsPage(driver, u.client, 99_999_999)
    expect(isServerError(p), `page: ${p.status}`).toBe(false)
  })
})
