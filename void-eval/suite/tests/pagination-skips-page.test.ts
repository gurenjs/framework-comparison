// Port of agents-on-guren tasks/pagination-skips-page/hidden/posts-index-pagination.test.ts
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Driver } from '../drivers/types.ts'
import { makeUser, postFixture, requireNoPosts, sleep } from '../lib/fixtures.ts'

const PER_PAGE = 10

describe('GET /posts pagination', () => {
  let driver: Driver
  /** All post ids, newest first: the order the list is expected to walk. */
  let newestFirst: number[]

  beforeAll(async () => {
    driver = loadDriver()
    // The hidden test deletes every pre-existing post; black-box we instead
    // require the run to start on an empty database (boot script resets it).
    await requireNoPosts(driver)
    const author = await makeUser(driver, { tag: 'pager' })
    const ids: number[] = []
    for (let i = 1; i <= 25; i++) {
      ids.push((await driver.createPost(author.client, postFixture(i))).id)
      await sleep(2) // distinct creation timestamps, whatever the ordering column
    }
    // Creation order is the "newest" order: ids are only compared, never
    // assumed contiguous.
    newestFirst = [...ids].reverse()
    expect(new Set(newestFirst).size).toBe(25)
  })

  const guest = () => driver.newClient()

  it('shows the 10 newest posts on the first page by default', async () => {
    const page = await driver.listPosts(guest())
    expect(page.ids).toEqual(newestFirst.slice(0, PER_PAGE))
  })

  it('treats ?page=1 the same as the default page', async () => {
    const page = await driver.listPosts(guest(), { page: 1 })
    expect(page.ids).toEqual(newestFirst.slice(0, PER_PAGE))
  })

  it('shows posts 11-20 (newest first) on ?page=2', async () => {
    const page = await driver.listPosts(guest(), { page: 2 })
    expect(page.ids).toEqual(newestFirst.slice(PER_PAGE, PER_PAGE * 2))
  })

  it('shows the 5 oldest posts on ?page=3', async () => {
    const page = await driver.listPosts(guest(), { page: 3 })
    expect(page.ids).toEqual(newestFirst.slice(PER_PAGE * 2, PER_PAGE * 3))
    expect(page.ids).toHaveLength(5)
  })

  it('reaches every post exactly once across the pages', async () => {
    const seen: number[] = []
    for (const page of [undefined, 2, 3]) {
      seen.push(...(await driver.listPosts(guest(), { page })).ids)
    }
    expect(seen).toEqual(newestFirst)
  })

  it('reports pagination meta that matches the page being shown', async () => {
    const first = await driver.listPosts(guest())
    expect(first.meta).toMatchObject({ currentPage: 1, lastPage: 3, perPage: PER_PAGE, total: 25, from: 1, to: 10 })

    const second = await driver.listPosts(guest(), { page: 2 })
    expect(second.meta).toMatchObject({ currentPage: 2, lastPage: 3, perPage: PER_PAGE, total: 25, from: 11, to: 20 })

    const third = await driver.listPosts(guest(), { page: 3 })
    expect(third.meta).toMatchObject({ currentPage: 3, lastPage: 3, perPage: PER_PAGE, total: 25, from: 21, to: 25 })
  })
})
