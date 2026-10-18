// Task helpers for tests/json-api-tokens.test.ts. Everything that differs
// between Guren and Void for this ticket lives here:
//   - session requests (POST /profile/tokens, DELETE /profile/tokens/:id):
//     Guren needs its XSRF-TOKEN cookie echoed as X-XSRF-TOKEN; Void (a
//     browser's same-origin fetch) sends `Origin`. Neither sends the page
//     protocol headers (X-Inertia / X-VoidPages): these are JSON routes, and
//     the hidden test calls them as a plain JSON client.
//   - the users table (Guren `users`, integer ids; Void Better Auth's `user`,
//     string ids), used to learn an account's id for `authorId` checks.
//   - the JSON validation status: Guren's statement pins 422; Void's route
//     validators answer 400, and its statement allows 400 or 422.
// Bearer requests are framework-neutral: a brand-new cookie jar per request,
// so no session cookie (and no CSRF cookie) can ever ride along.
import type { Client, Driver, Id } from '../types.ts'
import type { TestUser } from '../../lib/fixtures.ts'

export interface Sent {
  status: number
  headers: Headers
  bodyText: string
  /** The body parsed as JSON, or undefined when it is not JSON. */
  json: any
}

/** Statuses a JSON route may answer an input validation failure with. */
export function jsonValidationStatuses(driver: Driver): number[] {
  return driver.name === 'void' ? [400, 422] : [422]
}

async function finish(res: Response): Promise<Sent> {
  const bodyText = await res.text()
  let json: any
  try {
    json = JSON.parse(bodyText)
  } catch {}
  return { status: res.status, headers: res.headers, bodyText, json }
}

/** A request from a signed-in (or guest) browser session, JSON in and out, without the page protocol. Redirects not followed. */
export async function sessionRequest(driver: Driver, client: Client, method: string, path: string, body?: unknown): Promise<Sent> {
  const res = await driver.mutate(client, method, path, body, { pages: false })
  let json: any
  try {
    json = JSON.parse(res.bodyText)
  } catch {}
  return { status: res.status, headers: res.headers, bodyText: res.bodyText, json }
}

/**
 * A plain JSON API client with no cookies at all: `Accept: application/json`,
 * a JSON body when given, and `authorization` as the Authorization header
 * when given. Nothing framework-specific is added.
 */
export async function apiRequest(driver: Driver, method: string, path: string, authorization?: string, body?: unknown): Promise<Sent> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (authorization !== undefined) headers.Authorization = authorization
  const init: RequestInit = { headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  return finish(await driver.raw(driver.newClient(), method, path, init))
}

/** The redirect target's pathname, or null. */
export function locationPath(sent: Sent): string | null {
  const location = sent.headers.get('location')
  return location === null ? null : new URL(location, 'http://localhost').pathname
}

export function isJson(sent: Sent): boolean {
  return (sent.headers.get('content-type') ?? '').includes('application/json')
}

/** The account id of a registered test user. */
export function userId(driver: Driver, user: TestUser): Id {
  return driver.userIdByEmail(user.email)
}

// --- the pinned api_tokens table and the existing posts table ---------------

export function apiTokenRows(driver: Driver): Record<string, unknown>[] {
  return driver.sql('SELECT * FROM api_tokens')
}

/** Every column value of every api_tokens row, as text. */
export function apiTokenCells(driver: Driver): string[] {
  return apiTokenRows(driver).flatMap((row) =>
    Object.values(row).map((value) => {
      if (value === null || value === undefined) return ''
      if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8')
      return String(value)
    }),
  )
}

export function postCount(driver: Driver): number {
  return Number(driver.sql<{ n: number }>('SELECT COUNT(*) AS n FROM posts')[0]?.n ?? 0)
}

export interface PostRow {
  id: number
  title: string
  body: string
  author_id: Id
}

export function findPost(driver: Driver, id: Id): PostRow | undefined {
  return driver.sql<PostRow>('SELECT id, title, body, author_id FROM posts WHERE id = ?', [id])[0]
}

/**
 * Insert a post with an explicit `created_at`, as the hidden test's
 * `Post.forceCreate` does. Both apps keep `posts` with the same column names
 * and an ISO 8601 text `created_at`.
 */
export function insertPost(driver: Driver, post: { title: string; excerpt: string; body: string; authorId: Id; createdAt: string }): number {
  const rows = driver.sql<{ id: number }>(
    'INSERT INTO posts (title, excerpt, body, author_id, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [post.title, post.excerpt, post.body, post.authorId, post.createdAt],
  )
  const id = rows[0]?.id
  if (id === undefined) throw new Error('suite: inserting a post returned no id')
  return id
}
