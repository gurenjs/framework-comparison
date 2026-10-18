// Task helpers for tests/post-tags.test.ts. Everything that differs between
// the frameworks for this ticket lives here, built from the Driver's generic
// building blocks (mutate, page, sql):
//
//   - update URL:      Guren PUT /posts/:id        Void PUT /posts/:id?update
//   - page components: Guren posts/Index, posts/Show (Inertia)
//                      Void  posts, posts/[id]      (VoidPages)
//   - validation:      Guren 422 JSON { errors }   Void 200 page JSON with errors
import { expect } from 'bun:test'
import type { Client, Driver, Id, MutationResult } from '../types.ts'

export interface PostPayload {
  title: string
  excerpt: string
  body: string
  tags?: string
}

export type Submit = MutationResult & { location: string | null }

const COMPONENTS: Record<string, { index: string; show: string }> = {
  guren: { index: 'posts/Index', show: 'posts/Show' },
  void: { index: 'posts', show: 'posts/[id]' },
}

/** The status a validation failure of the post form answers with. */
export function validationStatus(driver: Driver): number {
  return driver.name === 'void' ? 200 : 422
}

/** Submit the create-post form (POST /posts) with `data` as the body. */
export function submitPost(driver: Driver, client: Client, data: PostPayload): Promise<Submit> {
  return driver.mutate(client, 'POST', '/posts', data)
}

/** Submit the edit-post form for post `id`. */
export function submitUpdate(driver: Driver, client: Client, id: Id, data: PostPayload): Promise<Submit> {
  const path = driver.name === 'void' ? `/posts/${id}?update` : `/posts/${id}`
  return driver.mutate(client, 'PUT', path, data)
}

async function pageProps<T>(driver: Driver, client: Client, path: string, kind: 'index' | 'show'): Promise<T> {
  const page = await driver.page(client, path)
  expect(page.status, `GET ${path}`).toBe(200)
  expect(page.component).toBe(COMPONENTS[driver.name][kind])
  return page.props as T
}

/** The post page's data (Guren: posts/Show props; Void: the page's loader data). */
export function showProps<T>(driver: Driver, client: Client, id: Id): Promise<T> {
  return pageProps<T>(driver, client, `/posts/${id}`, 'show')
}

/** The posts list page's data, `query` appended verbatim (e.g. `?tag=bun`). */
export function indexProps<T>(driver: Driver, client: Client, query = ''): Promise<T> {
  return pageProps<T>(driver, client, `/posts${query}`, 'index')
}
