// Port of agents-on-guren tasks/scheduled-publish/hidden/scheduled-publish.test.ts
//
// The ticket pins the column posts.published_at (ISO 8601 text), the form
// field `publishAt`, 404 on a scheduled post's page for everyone but its
// author, its absence from the list's and search's `data` for others, and
// `publishedAt` on the post the author sees. DB state is read and written by
// table name through driver.sql; "time passing" moves published_at into the
// past directly in the database, as the hidden test does.
//
// The hidden test gets a fresh database per case; here one database serves
// the whole file. No case counts rows globally, so nothing changes except
// that titles and search keywords carry a run-unique suffix. Every case
// creates at most two posts, so the posts it looks for are always on the
// first list page (newest first, 10 per page on both apps).
//
// hidden/scheduled-command.test.ts (the `posts:scheduled` console report) is
// not ported; see tasks/scheduled-publish/PORTING.md.
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Client, Driver, Id } from '../drivers/types.ts'
import {
  indexProps,
  postPage,
  postRowByTitle,
  searchData,
  setPublishedAt,
  showProps,
  submitPost,
  type PostProp,
} from '../drivers/ext/scheduled-publish.ts'
import { makeUser } from '../lib/fixtures.ts'

const DAY_MINUTES = 24 * 60
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

let seq = 0
function payload(extra: Record<string, unknown> = {}) {
  seq += 1
  return { title: `Scheduled post ${RUN} ${seq}`, excerpt: 'A short excerpt', body: 'The body of the post.', ...extra }
}

/** A time `minutes` from now, on a whole minute so storage at minute precision still compares equal. */
function minutesFromNow(minutes: number): Date {
  const MINUTE = 60_000
  return new Date(Math.ceil((Date.now() + minutes * MINUTE) / MINUTE) * MINUTE)
}

function expectSameInstant(actual: string | null | undefined, expected: Date) {
  expect(typeof actual).toBe('string')
  expect(Date.parse(actual as string)).toBe(expected.getTime())
}

describe('scheduled publishing', () => {
  let driver: Driver

  beforeAll(() => {
    driver = loadDriver()
  })

  const guest = () => driver.newClient()
  const signedIn = async () => (await makeUser(driver)).client

  /** Creates a post through the form endpoint as `client`; returns its row id. */
  async function storePost(client: Client, data: Record<string, unknown>): Promise<number> {
    const res = await submitPost(driver, client, data)
    expect([302, 303], `POST /posts: ${res.status} ${res.bodyText.slice(0, 300)}`).toContain(res.status)
    const row = postRowByTitle(driver, String(data.title))
    expect(row).not.toBeNull()
    return Number(row!.id)
  }

  /** Stores a post scheduled a day ahead; returns its id and the instant it was scheduled for. */
  async function storeScheduled(client: Client, title?: string) {
    const at = minutesFromNow(DAY_MINUTES)
    const data = payload({ publishAt: at.toISOString(), ...(title === undefined ? {} : { title }) })
    const id = await storePost(client, data)
    return { id, at, title: String(data.title) }
  }

  async function indexIds(client: Client): Promise<Id[]> {
    const props = await indexProps<{ data?: PostProp[] }>(driver, client)
    expect(Array.isArray(props.data)).toBe(true)
    return props.data!.map((post) => Number(post.id))
  }

  async function searchIds(client: Client, keyword: string): Promise<Id[]> {
    return (await searchData(driver, client, keyword)).map((post) => Number(post.id))
  }

  it('stores a future publishAt and shows the post page to its author only; others and guests get 404', async () => {
    const author = await signedIn()
    const other = await signedIn()
    const scheduled = await storeScheduled(author)

    const row = postRowByTitle(driver, scheduled.title)
    expectSameInstant(row!.published_at, scheduled.at)

    expect((await postPage(driver, guest(), scheduled.id)).status).toBe(404)
    expect((await postPage(driver, other, scheduled.id)).status).toBe(404)

    const props = await showProps<{ post?: PostProp }>(driver, author, scheduled.id)
    expect(Number(props.post?.id)).toBe(scheduled.id)
    expectSameInstant(props.post?.publishedAt, scheduled.at)
  })

  it('leaves a scheduled post out of the list for guests and other users, and lists it with its date for its author', async () => {
    const author = await signedIn()
    const other = await signedIn()
    const scheduled = await storeScheduled(author)
    // No publishAt at all: public at once, as posts are today.
    const publicId = await storePost(author, payload())

    for (const viewer of [guest(), other]) {
      const ids = await indexIds(viewer)
      expect(ids).toContain(publicId)
      expect(ids).not.toContain(scheduled.id)
    }

    const props = await indexProps<{ data?: PostProp[] }>(driver, author)
    const own = props.data?.find((post) => Number(post.id) === scheduled.id)
    expect(own).toBeDefined()
    expectSameInstant(own!.publishedAt, scheduled.at)
    expect(props.data!.map((post) => Number(post.id))).toContain(publicId)
  })

  it('leaves a scheduled post out of search for guests and other users', async () => {
    const author = await signedIn()
    const other = await signedIn()
    const keyword = `Zephyr${RUN}`
    const scheduled = await storeScheduled(author, `${keyword} launch notes, scheduled`)
    const publicId = await storePost(author, payload({ title: `${keyword} launch notes, public` }))

    for (const viewer of [guest(), other]) {
      const ids = await searchIds(viewer, keyword)
      expect(ids).toContain(publicId)
      expect(ids).not.toContain(scheduled.id)
    }
  })

  it('makes a post public once its published_at has passed, with no further action', async () => {
    const author = await signedIn()
    const keyword = `Quokka${RUN}`
    const scheduled = await storeScheduled(author, `${keyword} field report`)
    const viewer = guest()
    expect(await indexIds(viewer)).not.toContain(scheduled.id)

    // Time passing is simulated by moving the stored date an hour into the past.
    setPublishedAt(driver, scheduled.id, new Date(Date.now() - 60 * 60_000).toISOString())

    const props = await showProps<{ post?: PostProp }>(driver, viewer, scheduled.id)
    expect(Number(props.post?.id)).toBe(scheduled.id)
    expect(await indexIds(viewer)).toContain(scheduled.id)
    expect(await searchIds(viewer, keyword)).toContain(scheduled.id)
    expect(await indexIds(await signedIn())).toContain(scheduled.id)
  })

  it('rejects an unparsable publishAt the way an invalid title is rejected, and saves nothing', async () => {
    const client = await signedIn()

    // The framework's validation rejection (Guren 422 JSON, Void 200 page data), naming the field.
    const invalidTitle = await submitPost(driver, client, payload({ title: '' }))
    expect(Object.keys(invalidTitle.errors), invalidTitle.bodyText.slice(0, 300)).toContain('title')

    for (const publishAt of ['next tuesday', '2026-13-45T25:61:00Z']) {
      const data = payload({ publishAt })
      const res = await submitPost(driver, client, data)
      expect(res.status, res.bodyText.slice(0, 300)).toBe(invalidTitle.status)
      expect(Object.keys(res.errors), res.bodyText.slice(0, 300)).toContain('publishAt')
      expect(postRowByTitle(driver, String(data.title))).toBeNull()
    }
  })
})
