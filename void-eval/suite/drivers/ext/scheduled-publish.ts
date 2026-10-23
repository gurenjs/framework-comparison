// Task helpers for tests/scheduled-publish.test.ts. Everything that differs
// between the frameworks for this ticket lives here, built from the Driver's
// generic building blocks (mutate, page, sql):
//
//   - search:          Guren QUERY /posts/search with JSON { keywords } -> { data }
//                      Void  the posts list's keyword search, GET /posts?q=… -> page data `data`
//   - validation:      Guren 422 JSON { errors }   Void 200 page JSON with errors
//   - the posts table is the same on both (pinned: posts.published_at, text)
import { expect } from 'bun:test'
import type { Client, Driver, Id, PageResult, Submit } from '../types.ts'

export type { Submit }

export interface PostProp {
  id: Id
  title: string
  publishedAt?: string | null
}

export interface PostRow {
  id: number
  title: string
  author_id: Id
  published_at: string | null
}

/** Submit the create-post form (POST /posts) with `data` as the body, sent verbatim. */
export function submitPost(driver: Driver, client: Client, data: Record<string, unknown>): Promise<Submit> {
  return driver.mutate(client, 'POST', '/posts', data)
}

/** The post page through the framework's page-data protocol (status 404 when hidden). */
export function postPage(driver: Driver, client: Client, id: Id): Promise<PageResult> {
  return driver.page(client, `/posts/${id}`)
}

/** The post page's data; requires a 200 page of the post-page component. */
export async function showProps<T>(driver: Driver, client: Client, id: Id): Promise<T> {
  const page = await postPage(driver, client, id)
  expect(page.status, `GET /posts/${id}`).toBe(200)
  expect(page.component).toBe(driver.components.postShow)
  return page.props as T
}

/** The posts list page's data (page 1, no parameters). */
export async function indexProps<T>(driver: Driver, client: Client): Promise<T> {
  const page = await driver.page(client, '/posts')
  expect(page.status, 'GET /posts').toBe(200)
  expect(page.component).toBe(driver.components.postIndex)
  return page.props as T
}

/** The `data` of the app's existing keyword search for one keyword. */
export async function searchData(driver: Driver, client: Client, keyword: string): Promise<PostProp[]> {
  if (driver.name === 'void') {
    const page = await driver.page(client, `/posts?q=${encodeURIComponent(keyword)}`)
    expect(page.status, 'GET /posts?q=').toBe(200)
    expect(page.component).toBe(driver.components.postIndex)
    const data = page.props?.data
    expect(Array.isArray(data)).toBe(true)
    return data as PostProp[]
  }
  // QUERY is a safe method; mutate only adds the CSRF header and JSON body the
  // generated client would send, and throws on a CSRF rejection.
  const res = await driver.mutate(client, 'QUERY', '/posts/search', { keywords: [keyword] })
  expect(res.status, `QUERY /posts/search: ${res.bodyText.slice(0, 200)}`).toBe(200)
  const body = JSON.parse(res.bodyText) as { data?: PostProp[] }
  expect(Array.isArray(body.data)).toBe(true)
  return body.data!
}

// --- the pinned table ---------------------------------------------------------

export function postRowByTitle(driver: Driver, title: string): PostRow | null {
  const rows = driver.sql<PostRow>('SELECT id, title, author_id, published_at FROM posts WHERE title = ? ORDER BY id', [title])
  return rows[0] ?? null
}

/** Sets published_at directly, as ops would with a database console. */
export function setPublishedAt(driver: Driver, postId: Id, value: string | null): void {
  driver.sql('UPDATE posts SET published_at = ? WHERE id = ?', [value, postId])
}
