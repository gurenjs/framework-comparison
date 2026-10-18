// Task helpers for tests/post-tags.test.ts. Everything that differs between
// the frameworks for this ticket lives here, built from the Driver's generic
// building blocks (mutate, page, updatePost, components, formValidationStatus).
import { expect } from 'bun:test'
import type { Client, Driver, Id, Submit } from '../types.ts'

export type { Submit }

export interface PostPayload {
  title: string
  excerpt: string
  body: string
  tags?: string
}

/** The status a validation failure of the post form answers with. */
export function validationStatus(driver: Driver): number {
  return driver.formValidationStatus
}

/** Submit the create-post form (POST /posts) with `data` as the body. */
export function submitPost(driver: Driver, client: Client, data: PostPayload): Promise<Submit> {
  return driver.mutate(client, 'POST', '/posts', data)
}

/** Submit the edit-post form for post `id`. */
export function submitUpdate(driver: Driver, client: Client, id: Id, data: PostPayload): Promise<Submit> {
  return driver.updatePost(client, id, { ...data })
}

async function pageProps<T>(driver: Driver, client: Client, path: string, kind: 'index' | 'show'): Promise<T> {
  const page = await driver.page(client, path)
  expect(page.status, `GET ${path}`).toBe(200)
  expect(page.component).toBe(kind === 'index' ? driver.components.postIndex : driver.components.postShow)
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
