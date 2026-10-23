// Task helpers for tests/comments-moderation.test.ts. Everything that differs
// between Guren and Void for this ticket lives here:
//   - the comment endpoint: Guren POST /posts/:id/comments, Void the post
//     page's named action POST /posts/:id?comment
//   - sending a `Referer` header on delete (the hidden test sends one, so a
//     "redirect back" and a redirect to the post agree).
import type { Client, Driver, Id, PageResult, Submit } from '../types.ts'
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

export type Sent = Submit

export const postPageComponent = (driver: Driver) => driver.components.postShow

/** The account id of a registered test user. */
export function userId(driver: Driver, user: TestUser): Id {
  return driver.userIdByEmail(user.email)
}

/** Submit a comment on a post (Guren POST /posts/:id/comments; Void POST /posts/:id?comment). */
export function postComment(driver: Driver, client: Client, postId: Id, body: string): Promise<Sent> {
  const path = driver.name === 'void' ? `/posts/${postId}?comment` : `/posts/${postId}/comments`
  return driver.mutate(client, 'POST', path, { body })
}

/** DELETE /comments/:id, sent from the post page (Referer = the post). */
export function deleteComment(driver: Driver, client: Client, commentId: Id, postId: Id): Promise<Sent> {
  return driver.mutate(client, 'DELETE', `/comments/${commentId}`, undefined, { headers: { Referer: new URL(`/posts/${postId}`, driver.baseUrl).href } })
}

/** POST /comments/:id/report. */
export function reportComment(driver: Driver, client: Client, commentId: Id): Promise<Sent> {
  return driver.mutate(client, 'POST', `/comments/${commentId}/report`)
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
