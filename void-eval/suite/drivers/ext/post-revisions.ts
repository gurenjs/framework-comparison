// Task helpers for tests/post-revisions.test.ts. Everything that differs
// between the frameworks for this ticket lives here, built from the Driver's
// generic building blocks (mutate, page, raw, sql):
//
//   - update URL:  Guren PUT /posts/:id    Void PUT /posts/:id?update
//
// The revisions page (GET /posts/:id/revisions) and the restore endpoint
// (POST /posts/:id/revisions/:revisionId/restore) are pinned with the same URL
// on both apps. The page data is read through driver.page (Guren: Inertia
// props, Void: the loader's page data); the component name is not pinned.
import type { Client, Driver, Id, MutationResult, PageResult } from '../types.ts'

export interface PostContent {
  title: string
  excerpt: string
  body: string
}

export type Submit = MutationResult & { location: string | null }

/** Submit the edit-post form for post `id`. */
export function submitUpdate(driver: Driver, client: Client, id: Id, data: PostContent): Promise<Submit> {
  const path = driver.name === 'void' ? `/posts/${id}?update` : `/posts/${id}`
  return driver.mutate(client, 'PUT', path, data)
}

/** POST /posts/:id/revisions/:revisionId/restore, sent the way the framework's client sends a mutation. */
export function restoreRevision(driver: Driver, client: Client, postId: Id, revisionId: Id): Promise<Submit> {
  return driver.mutate(client, 'POST', `/posts/${postId}/revisions/${revisionId}/restore`)
}

/** The revisions page read through the framework's page-data protocol. */
export function revisionsPage(driver: Driver, client: Client, postId: Id): Promise<PageResult> {
  return driver.page(client, `/posts/${postId}/revisions`)
}

/** A plain browser GET of the revisions page (no page-data headers), redirects not followed. */
export async function revisionsPlainGet(driver: Driver, client: Client, postId: Id): Promise<{ status: number; location: string | null }> {
  const res = await driver.raw(client, 'GET', `/posts/${postId}/revisions`)
  await res.arrayBuffer()
  const location = res.headers.get('location')
  return { status: res.status, location: location ? new URL(location, driver.baseUrl).pathname : null }
}
