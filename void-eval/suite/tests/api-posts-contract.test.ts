// Port of agents-on-guren tasks/api-posts-contract/hidden/api-posts.test.ts
// (first describe block only; the typed-surface block is a per-framework
// static check, see README). The integer-only `?author=abc|0` cases live in
// extras/api-posts-contract.integer-author.test.ts and are not part of the shared grade.
//
// GET /api/posts is itself the contract under test, so it is requested
// directly (driver.raw) from a cookie-less client: no session, no CSRF.
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Driver, Id } from '../drivers/types.ts'
import { makeUser, postFixture, requireNoPosts, sleep, type TestUser } from '../lib/fixtures.ts'

interface ApiPost {
  id: number | string
  title: string
  excerpt: string
  createdAt: string
  author?: { id: number | string; name: string }
}

interface ApiPostsResponse {
  data: ApiPost[]
  meta: { currentPage: number; lastPage: number; perPage: number; total: number }
}

describe('GET /api/posts', () => {
  let driver: Driver
  let authorA: TestUser
  let authorB: TestUser
  /** Ids of A's and B's posts in creation order (oldest first). */
  let created: Array<{ id: Id; author: 'A' | 'B' }>
  /** Account ids (the hidden test read them from the DB). */
  const authorIds = {} as Record<'A' | 'B', Id>

  async function getJson(url: string): Promise<{ status: number; body: ApiPostsResponse }> {
    const res = await driver.raw(driver.newClient(), 'GET', url, { headers: { Accept: 'application/json' } })
    const contentType = res.headers.get('content-type') ?? ''
    expect(contentType).toContain('application/json')
    return { status: res.status, body: (await res.json()) as ApiPostsResponse }
  }

  /** Account id of a user, read from the public page of a post they wrote (not from the API under test). */
  async function accountIdVia(postId: Id): Promise<Id> {
    const id = (await driver.getPost(driver.newClient(), postId))?.author?.id
    if (typeof id !== 'number' && typeof id !== 'string') throw new Error(`driver.getPost(${postId}) did not expose author.id`)
    return id
  }

  beforeAll(async () => {
    driver = loadDriver()
    await requireNoPosts(driver)
    authorA = await makeUser(driver, { name: 'Alice Author', tag: 'alice' })
    authorB = await makeUser(driver, { name: 'Bob Author', tag: 'bob' })
    created = []
    // 12 posts, each strictly newer than the last. Alternate authors, with
    // the newest also going to A (A: 7, B: 5), exactly as the hidden test.
    for (let i = 1; i <= 12; i++) {
      const who = i % 2 === 1 || i === 12 ? 'A' : 'B'
      const owner = who === 'A' ? authorA : authorB
      const { id } = await driver.createPost(owner.client, postFixture(i))
      created.push({ id, author: who })
      await sleep(5) // distinct createdAt whether a solution orders by timestamp or id
    }
    authorIds.A = await accountIdVia(created.find((p) => p.author === 'A')!.id)
    authorIds.B = await accountIdVia(created.find((p) => p.author === 'B')!.id)
    expect(authorIds.A).not.toBe(authorIds.B)
  })

  it('returns the 10 newest posts as JSON with pagination meta, without authentication', async () => {
    const { status, body } = await getJson('/api/posts')
    expect(status).toBe(200)

    const newestTen = [...created].reverse().slice(0, 10).map((p) => p.id)
    expect(body.data.map((p) => p.id)).toEqual(newestTen)

    expect(body.meta).toMatchObject({ currentPage: 1, lastPage: 2, perPage: 10, total: 12 })
  })

  it('serializes each post with the fields the pages receive, including the author', async () => {
    const { body } = await getJson('/api/posts')
    const owner = new Map(created.map((p) => [p.id, p.author]))
    const names = { A: authorA.name, B: authorB.name }
    expect(body.data.length).toBeGreaterThan(0)

    for (const post of body.data) {
      expect(['number', 'string']).toContain(typeof post.id)
      expect(typeof post.title).toBe('string')
      expect(post.title.length).toBeGreaterThan(0)
      expect(typeof post.excerpt).toBe('string')
      expect(post.excerpt.length).toBeGreaterThan(0)
      expect(typeof post.createdAt).toBe('string')
      expect(Number.isNaN(Date.parse(post.createdAt))).toBe(false)

      const who = owner.get(post.id)
      expect(who).toBeDefined()
      expect(post.author).toBeDefined()
      expect(post.author?.id).toBe(authorIds[who!])
      expect(post.author?.name).toBe(names[who!])
    }
  })

  it('serves the remaining posts on page 2', async () => {
    const { status, body } = await getJson('/api/posts?page=2')
    expect(status).toBe(200)

    const oldestTwo = [...created].reverse().slice(10).map((p) => p.id)
    expect(body.data.map((p) => p.id)).toEqual(oldestTwo)
    expect(body.meta).toMatchObject({ currentPage: 2, lastPage: 2, perPage: 10, total: 12 })
  })

  it('filters to a single author with ?author=<id>, newest first, with meta for the filtered set', async () => {
    const aId = authorIds.A
    const { status, body } = await getJson(`/api/posts?author=${aId}`)
    expect(status).toBe(200)

    const mine = created.filter((p) => p.author === 'A').map((p) => p.id).reverse()
    expect(mine).toHaveLength(7)
    expect(body.data.map((p) => p.id)).toEqual(mine)
    for (const post of body.data) {
      expect(post.author?.id).toBe(aId)
    }
    expect(body.meta).toMatchObject({ currentPage: 1, lastPage: 1, perPage: 10, total: 7 })
  })

  it('combines the author filter with paging', async () => {
    const bId = authorIds.B
    const { status, body } = await getJson(`/api/posts?author=${bId}&page=1`)
    expect(status).toBe(200)

    const theirs = created.filter((p) => p.author === 'B').map((p) => p.id).reverse()
    expect(theirs).toHaveLength(5)
    expect(body.data.map((p) => p.id)).toEqual(theirs)
    expect(body.meta).toMatchObject({ currentPage: 1, lastPage: 1, perPage: 10, total: 5 })
  })

  it('returns an empty page for an author with no posts', async () => {
    // The hidden test creates a user with no posts and filters by its id.
    // Black-box, an account's id is only observable through a post it wrote,
    // so the user writes one, its id is read, and the post is deleted again.
    const nobody = await makeUser(driver, { name: 'No Posts', tag: 'nobody' })
    const { id: tmpPost } = await driver.createPost(nobody.client, postFixture('temporary'))
    const nobodyId = await accountIdVia(tmpPost)
    expect([302, 303]).toContain((await driver.deletePost(nobody.client, tmpPost)).status)
    expect(await driver.getPostStatus(driver.newClient(), tmpPost)).toBe(404)

    const { status, body } = await getJson(`/api/posts?author=${nobodyId}`)
    expect(status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.meta).toMatchObject({ currentPage: 1, total: 0 })
  })

  it('returns an empty page for an author id that matches no account', async () => {
    const { status, body } = await getJson(`/api/posts?author=${encodeURIComponent(String(driver.absentUserId()))}`)
    expect(status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.meta).toMatchObject({ currentPage: 1, total: 0 })
  })

  it('rejects an invalid page parameter with 400 or 422 and a JSON body', async () => {
    // Hidden test: strictly 422. Shared grade accepts 400 or 422 (Void's
    // declared route validators answer 400); strict 422 is a Guren extra.
    for (const url of ['/api/posts?page=0', '/api/posts?page=abc']) {
      const res = await driver.raw(driver.newClient(), 'GET', url, { headers: { Accept: 'application/json' } })
      expect([400, 422], url).toContain(res.status)
      expect(res.headers.get('content-type') ?? '', url).toContain('application/json')
      await res.json()
    }
  })
})
