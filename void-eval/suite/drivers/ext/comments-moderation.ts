// Task helpers for tests/comments-moderation.test.ts. Everything that differs
// between Guren and Void for this ticket lives here:
//   - the comment endpoint: Guren POST /posts/:id/comments, Void the post
//     page's named action POST /posts/:id?comment
//   - the post page component name (Guren `posts/Show`, Void `posts/[id]`)
//   - the users table (Guren `users`, Void Better Auth's `user`), used to
//     learn an account's id for comparing with `comments.user_id` and
//     `author.id`
//   - sending a `Referer` header (the hidden test sends one on delete, so a
//     "redirect back" and a redirect to the post agree); Driver.mutate has no
//     header parameter, so this rebuilds each driver's mutation headers on
//     top of `driver.raw`.
import type { Client, Driver, Id, PageResult } from '../types.ts'
import type { TestUser } from '../../lib/fixtures.ts'

export interface CommentProp {
  id: Id
  body: string
  author: { id: Id; name: string }
  createdAt: string
}

export interface CommentRow {
  id: Id
  post_id: Id
  user_id: Id
  body: string
}

export interface Sent {
  status: number
  location: string | null
  bodyText: string
}

export const postPageComponent = (driver: Driver) => (driver.name === 'void' ? 'posts/[id]' : 'posts/Show')

/** The account id of a registered test user, read from the framework's users table by email. */
export function userId(driver: Driver, user: TestUser): Id {
  const table = driver.name === 'void' ? '"user"' : 'users'
  const rows = driver.sql<{ id: Id }>(`SELECT id FROM ${table} WHERE email = ?`, [user.email])
  if (rows.length !== 1) throw new Error(`suite: no account row for ${user.email}`)
  return rows[0]!.id
}

/** A mutation with the framework's own headers plus `extra` (e.g. Referer). Redirects not followed. */
async function send(driver: Driver, client: Client, method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<Sent> {
  const headers: Record<string, string> = { Accept: 'application/json', ...extra }
  if (driver.name === 'void') {
    headers.Origin = new URL(driver.baseUrl).origin
    headers['X-VoidPages'] = 'true'
  } else {
    if (!client.jar.has('XSRF-TOKEN')) await (await driver.raw(client, 'GET', '/health')).arrayBuffer()
    const token = client.jar.get('XSRF-TOKEN')
    if (!token) throw new Error('suite: no XSRF-TOKEN cookie after GET /health')
    headers['X-XSRF-TOKEN'] = decodeURIComponent(token)
  }
  const init: RequestInit = { headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const res = await driver.raw(client, method, path, init)
  const bodyText = await res.text()
  if (res.status === 403 && (/CSRF token mismatch/.test(bodyText) || (driver.name === 'void' && /origin/i.test(bodyText)))) {
    throw new Error(`suite: ${method} ${path} was rejected by the CSRF/origin check (harness bug, not app behaviour)`)
  }
  const location = res.headers.get('location')
  return { status: res.status, bodyText, location: location ? new URL(location, driver.baseUrl).pathname : null }
}

/** Submit a comment on a post (Guren POST /posts/:id/comments; Void POST /posts/:id?comment). */
export function postComment(driver: Driver, client: Client, postId: Id, body: string): Promise<Sent> {
  const path = driver.name === 'void' ? `/posts/${postId}?comment` : `/posts/${postId}/comments`
  return send(driver, client, 'POST', path, { body })
}

/** DELETE /comments/:id, sent from the post page (Referer = the post). */
export function deleteComment(driver: Driver, client: Client, commentId: Id, postId: Id): Promise<Sent> {
  return send(driver, client, 'DELETE', `/comments/${commentId}`, undefined, { Referer: new URL(`/posts/${postId}`, driver.baseUrl).href })
}

/** POST /comments/:id/report. */
export function reportComment(driver: Driver, client: Client, commentId: Id): Promise<Sent> {
  return send(driver, client, 'POST', `/comments/${commentId}/report`)
}

/** The post page through the framework's page-data protocol. */
export function postPage(driver: Driver, client: Client, postId: Id): Promise<PageResult> {
  return driver.page(client, `/posts/${postId}`)
}

// --- the pinned tables ------------------------------------------------------

export function commentsOnPost(driver: Driver, postId: Id): CommentRow[] {
  return driver.sql<CommentRow>('SELECT id, post_id, user_id, body FROM comments WHERE post_id = ? ORDER BY id', [postId])
}

export function commentById(driver: Driver, id: Id): CommentRow | undefined {
  return driver.sql<CommentRow>('SELECT id, post_id, user_id, body FROM comments WHERE id = ?', [id])[0]
}

export function commentByBody(driver: Driver, body: string): CommentRow | undefined {
  return driver.sql<CommentRow>('SELECT id, post_id, user_id, body FROM comments WHERE body = ?', [body])[0]
}

export function reportCount(driver: Driver, commentId: Id, reporterId?: Id): number {
  const rows =
    reporterId === undefined
      ? driver.sql<{ n: number }>('SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ?', [commentId])
      : driver.sql<{ n: number }>('SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ? AND user_id = ?', [commentId, reporterId])
  return Number(rows[0]?.n ?? 0)
}
