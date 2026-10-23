// Robustness extra (not graded): "editing a post can set, change or clear the
// date", "a time that has already passed means the post is public", and a
// scheduled post stays hidden from everyone else on its edit form and its
// update too (the statement: "its page answers as if it did not exist").
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../../drivers/index.ts'
import type { Driver } from '../../drivers/types.ts'
import { makeUser } from '../../lib/fixtures.ts'
import { isForbidden } from '../../lib/robust.ts'
import { postRowByTitle, submitPost } from '../../drivers/ext/scheduled-publish.ts'

let seq = 0
const unique = () => `Sched ~${++seq} ${Date.now()}`
const future = () => new Date(Date.now() + 7 * 86_400_000).toISOString()
const past = () => new Date(Date.now() - 86_400_000).toISOString()

describe('scheduled publishing: robustness (extra)', () => {
  let driver: Driver
  beforeAll(() => {
    driver = loadDriver()
  })

  async function store(client: ReturnType<Driver['newClient']>, publishAt: string | null) {
    const title = unique()
    const res = await submitPost(driver, client, { title, excerpt: 'E', body: 'B', publishAt })
    expect([302, 303], `store: ${res.status} ${res.bodyText.slice(0, 200)}`).toContain(res.status)
    const row = postRowByTitle(driver, title)
    expect(row).not.toBeNull()
    return { id: row!.id, title }
  }

  it('makes a post created with a past publishAt public at once', async () => {
    const author = await makeUser(driver, { tag: 'rs' })
    const { id } = await store(author.client, past())
    expect(await driver.getPostStatus(driver.newClient(), id)).toBe(200)
  })

  it('makes a scheduled post public when an edit clears the date', async () => {
    const author = await makeUser(driver, { tag: 'rs' })
    const { id, title } = await store(author.client, future())
    expect(await driver.getPostStatus(driver.newClient(), id)).toBe(404)
    const res = await driver.updatePost(author.client, id, { title, excerpt: 'E', body: 'B', publishAt: null })
    expect([302, 303], `update: ${res.status}`).toContain(res.status)
    expect(await driver.getPostStatus(driver.newClient(), id)).toBe(200)
  })

  it("hides a scheduled post's edit form from other users and refuses their update", async () => {
    const author = await makeUser(driver, { tag: 'rs-author' })
    const other = await makeUser(driver, { tag: 'rs-other' })
    const { id, title } = await store(author.client, future())
    const edit = await driver.page(other.client, `/posts/${id}/edit`)
    expect(isForbidden(edit), `edit page: ${edit.status}`).toBe(true)
    const res = await driver.updatePost(other.client, id, { title: 'taken over', excerpt: 'E', body: 'B', publishAt: null })
    expect(isForbidden(res), `update: ${res.status}`).toBe(true)
    expect(postRowByTitle(driver, title)).not.toBeNull()
  })
})
