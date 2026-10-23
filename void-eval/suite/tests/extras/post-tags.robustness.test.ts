// Robustness extra (not graded): rules the statement states that the graded
// cases leave out: an empty field detaches every tag, empty entries are
// ignored, names are case-sensitive, a tagged post can still be deleted,
// authorization stays as it is, and odd input never answers 5xx.
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../../drivers/index.ts'
import type { Client, Driver, Id } from '../../drivers/types.ts'
import { makeUser } from '../../lib/fixtures.ts'
import { isForbidden, isServerError } from '../../lib/robust.ts'
import { submitPost, submitUpdate } from '../../drivers/ext/post-tags.ts'

let seq = 0
const uniqueTitle = () => `Tagged ~${++seq} ${Date.now()}`

describe('post tags: robustness (extra)', () => {
  let driver: Driver
  beforeAll(() => {
    driver = loadDriver()
  })

  const tagsOf = (postId: Id) =>
    driver
      .sql<{ name: string }>('select t.name as name from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = ? order by t.name', [postId])
      .map((r) => r.name)

  async function store(client: Client, tags: unknown): Promise<{ id: number; title: string }> {
    const title = uniqueTitle()
    const res = await submitPost(driver, client, { title, excerpt: 'E', body: 'B', tags } as never)
    expect([302, 303], `store: ${res.status} ${res.bodyText.slice(0, 200)}`).toContain(res.status)
    const row = driver.sql<{ id: number }>('select id from posts where title = ?', [title])[0]
    expect(row).toBeDefined()
    return { id: row!.id, title }
  }

  it('ignores empty entries ("a,,b," is the two tags a and b)', async () => {
    const u = await makeUser(driver, { tag: 'rt' })
    const a = `a${seq}x`, b = `b${seq}x`
    const { id } = await store(u.client, `${a},,${b},`)
    expect(tagsOf(id)).toEqual([a, b].sort())
  })

  it('treats names as case-sensitive', async () => {
    const u = await makeUser(driver, { tag: 'rt' })
    const n = `Case${Date.now()}`
    const { id } = await store(u.client, `${n}, ${n.toLowerCase()}`)
    expect(tagsOf(id)).toHaveLength(2)
  })

  it('detaches every tag when an edit sends the field empty', async () => {
    const u = await makeUser(driver, { tag: 'rt' })
    const { id, title } = await store(u.client, 'one, two')
    const res = await submitUpdate(driver, u.client, id, { title, excerpt: 'E', body: 'B', tags: '' })
    expect([302, 303], `update: ${res.status}`).toContain(res.status)
    expect(tagsOf(id)).toEqual([])
  })

  it("refuses another user's edit of a tagged post and keeps its tags", async () => {
    const owner = await makeUser(driver, { tag: 'rt-owner' })
    const other = await makeUser(driver, { tag: 'rt-other' })
    const { id, title } = await store(owner.client, 'keep')
    const res = await submitUpdate(driver, other.client, id, { title, excerpt: 'E', body: 'B', tags: 'stolen' })
    expect(isForbidden(res), `update: ${res.status}`).toBe(true)
    expect(tagsOf(id)).toEqual(['keep'])
  })

  it('deletes a tagged post and its post_tags rows', async () => {
    const u = await makeUser(driver, { tag: 'rt' })
    const { id } = await store(u.client, 'gone, soon')
    const res = await driver.deletePost(u.client, id)
    expect(res.ok, `delete: ${res.status}`).toBe(true)
    expect(driver.sql('select post_id from post_tags where post_id = ?', [id])).toHaveLength(0)
  })

  it('answers non-string tags and an odd ?tag= without a server error', async () => {
    const u = await makeUser(driver, { tag: 'rt' })
    for (const tags of [['x', 'y'], 42, { a: 1 }]) {
      const res = await submitPost(driver, u.client, { title: uniqueTitle(), excerpt: 'E', body: 'B', tags } as never)
      expect(isServerError(res), `tags ${JSON.stringify(tags)}: ${res.status}`).toBe(false)
    }
    const page = await driver.page(driver.newClient(), `/posts?tag=${encodeURIComponent(`' OR 1=1 --`)}`)
    expect(page.status).toBe(200)
  })
})
