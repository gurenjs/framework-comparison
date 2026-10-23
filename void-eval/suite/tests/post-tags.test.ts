// Port of agents-on-guren tasks/post-tags/hidden/post-tags.test.ts
//
// The ticket pins the tables `tags` (id, name) and `post_tags` (post_id,
// tag_id), the `tags` form field, `?tag=` on the posts list and `tags:
// string[]` on every post the list page and the post page receive. DB state
// is read by table name through driver.sql.
//
// The hidden test gets a fresh database per case; here one database serves
// the whole file. So global assertions ("the tags table holds exactly X",
// "post_tags has 0 rows") become before/after comparisons: the request may
// add exactly the expected rows and nothing else. The filter case uses tag
// names unique to this run so earlier cases' `bun` posts cannot show up.
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Client, Driver, Id } from '../drivers/types.ts'
import { indexProps, showProps, submitPost, submitUpdate, validationStatus, type PostPayload, type Submit } from '../drivers/ext/post-tags.ts'
import { makeUser } from '../lib/fixtures.ts'

interface PostProps {
  id: Id
  title: string
  tags?: unknown
}

interface IndexProps {
  data: PostProps[]
  pagination?: { meta?: { total?: number } }
}

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
let seq = 0
function payload(tags?: string): PostPayload {
  seq += 1
  return {
    title: `Tagged post ${RUN} ${seq}`,
    excerpt: 'A short excerpt',
    body: 'The body of the post.',
    ...(tags === undefined ? {} : { tags }),
  }
}

describe('post tags', () => {
  let driver: Driver

  beforeAll(() => {
    driver = loadDriver()
  })

  const guest = () => driver.newClient()

  function tagNames(): string[] {
    return driver.sql<{ name: string }>('select name from tags order by name').map((row) => row.name)
  }

  function tagsOfPost(postId: Id): string[] {
    return driver
      .sql<{ name: string }>(
        'select t.name as name from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = ? order by t.name',
        [postId],
      )
      .map((row) => row.name)
  }

  function postIdByTitle(title: string): number | null {
    const found = driver.sql<{ id: number }>('select id from posts where title = ?', [title])
    return found.length === 1 ? Number(found[0].id) : null
  }

  function countRows(table: 'posts' | 'tags' | 'post_tags'): number {
    return Number(driver.sql<{ n: number }>(`select count(*) as n from ${table}`)[0].n)
  }

  /** The tag names expected after adding `added` to `before` (set union, sorted like `order by name`). */
  function union(before: string[], added: string[]): string[] {
    return [...new Set([...before, ...added])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  }

  /** Create a post through the form endpoint; returns its id. */
  async function storePost(client: Client, tags?: string): Promise<number> {
    const data = payload(tags)
    const res = await submitPost(driver, client, data)
    expect([302, 303], `status ${res.status}: ${res.bodyText.slice(0, 300)}`).toContain(res.status)
    const id = postIdByTitle(data.title)
    expect(id).not.toBeNull()
    return id as number
  }

  /** The failure an invalid title produces today — the ticket asks tags to fail the same way. */
  async function invalidTitle(client: Client): Promise<Submit> {
    const data = { ...payload(), title: '' }
    const res = await submitPost(driver, client, data)
    // What the baseline answers an empty title with: Guren 422 JSON, Void a
    // 200 page object whose errors name the field.
    expect(res.status).toBe(validationStatus(driver))
    expect(Object.keys(res.errors)).toContain('title')
    return res
  }

  async function expectRejectedLikeTitle(client: Client, tags: string) {
    const expected = await invalidTitle(client)
    const data = payload(tags)
    const res = await submitPost(driver, client, data)
    expect(res.status, res.bodyText.slice(0, 300)).toBe(expected.status)
    expect(Object.keys(res.errors).some((key) => key.startsWith('tags')), JSON.stringify(res.errors)).toBe(true)
    expect(postIdByTitle(data.title)).toBeNull()
  }

  it('stores "bun, webdev" as two tags of the new post and the post page shows them', async () => {
    const author = await makeUser(driver, { tag: 'tagger' })
    const before = tagNames()

    const id = await storePost(author.client, 'bun, webdev')

    expect(tagNames()).toEqual(union(before, ['bun', 'webdev']))
    expect(tagsOfPost(id)).toEqual(['bun', 'webdev'])

    const props = await showProps<{ post: PostProps }>(driver, guest(), id)
    expect(props.post.tags).toEqual(['bun', 'webdev'])
  })

  it('editing the field down to "bun" disassociates webdev from the post', async () => {
    const author = await makeUser(driver, { tag: 'tagger' })
    const id = await storePost(author.client, 'bun, webdev')

    const res = await submitUpdate(driver, author.client, id, payload('bun'))
    expect([302, 303], `status ${res.status}: ${res.bodyText.slice(0, 300)}`).toContain(res.status)

    expect(tagsOfPost(id)).toEqual(['bun'])
    const props = await showProps<{ post: PostProps }>(driver, guest(), id)
    expect(props.post.tags).toEqual(['bun'])
  })

  it('?tag=bun lists only the posts carrying bun, an unknown tag lists none, and every listed post carries its tags', async () => {
    // Run-unique names stand in for `bun` / `webdev`: earlier cases in this
    // file already attached `bun` to other posts.
    const bun = `bun-${RUN}`
    const webdev = `webdev-${RUN}`
    const author = await makeUser(driver, { tag: 'tagger' })
    const bunPost = await storePost(author.client, bun)
    const webdevPost = await storePost(author.client, webdev)
    const untagged = await storePost(author.client)

    const all = await indexProps<IndexProps>(driver, guest())
    const byId = new Map(all.data.map((post) => [Number(post.id), post]))
    expect(byId.get(bunPost)?.tags).toEqual([bun])
    expect(byId.get(webdevPost)?.tags).toEqual([webdev])
    expect(byId.get(untagged)?.tags).toEqual([])
    for (const post of all.data) expect(Array.isArray(post.tags)).toBe(true)

    const filtered = await indexProps<IndexProps>(driver, guest(), `?tag=${encodeURIComponent(bun)}`)
    expect(filtered.data.map((post) => Number(post.id))).toEqual([bunPost])
    expect(filtered.data[0].tags).toEqual([bun])
    if (filtered.pagination?.meta?.total !== undefined) expect(filtered.pagination.meta.total).toBe(1)

    const other = await indexProps<IndexProps>(driver, guest(), `?tag=no-such-tag-${RUN}`)
    expect(other.data).toEqual([])
  })

  it('rejects six tags the same way an invalid title is rejected and saves nothing', async () => {
    const author = await makeUser(driver, { tag: 'tagger' })
    const tagsBefore = tagNames()
    const postTagsBefore = countRows('post_tags')

    await expectRejectedLikeTitle(author.client, 'one, two, three, four, five, six')
    expect(tagNames()).toEqual(tagsBefore)
    expect(countRows('post_tags')).toBe(postTagsBefore)
  })

  it('rejects a 31-character tag name and accepts a 30-character one', async () => {
    const author = await makeUser(driver, { tag: 'tagger' })
    const postTagsBefore = countRows('post_tags')

    await expectRejectedLikeTitle(author.client, `bun, ${'x'.repeat(31)}`)
    expect(countRows('post_tags')).toBe(postTagsBefore)

    const id = await storePost(author.client, 'y'.repeat(30))
    expect(tagsOfPost(id)).toEqual(['y'.repeat(30)])
  })

  it('collapses " bun ,bun" into the single tag bun', async () => {
    const author = await makeUser(driver, { tag: 'tagger' })
    const before = tagNames()
    const postTagsBefore = countRows('post_tags')

    const id = await storePost(author.client, ' bun ,bun')

    expect(tagNames()).toEqual(union(before, ['bun']))
    expect(countRows('post_tags')).toBe(postTagsBefore + 1)
    expect(tagsOfPost(id)).toEqual(['bun'])
    const props = await showProps<{ post: PostProps }>(driver, guest(), id)
    expect(props.post.tags).toEqual(['bun'])
  })
})
