import { eq } from 'drizzle-orm'

import { db } from '../db'
import { comments, posts } from '../db/schema'
import { CommentSchema, fieldErrors, type FieldErrors } from './validation'

export type CommentMutationResult =
  | { status: 'not-found' }
  | { status: 'invalid'; errors: FieldErrors }
  | { status: 'ok'; comment: typeof comments.$inferSelect }

export async function addComment(
  authorId: number,
  postId: number,
  body: string,
): Promise<CommentMutationResult> {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) })
  if (!post) return { status: 'not-found' }

  const parsed = CommentSchema.safeParse({ body })
  if (!parsed.success) {
    return { status: 'invalid', errors: fieldErrors(parsed.error) }
  }
  const [comment] = await db
    .insert(comments)
    .values({ body: parsed.data.body, postId, authorId })
    .returning()
  return { status: 'ok', comment }
}

/** A comment can be deleted by its author or by the post's author (SPEC §3). */
export async function deleteComment(
  userId: number,
  id: number,
): Promise<'not-found' | 'forbidden' | 'ok'> {
  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, id),
    with: { post: { columns: { authorId: true } } },
  })
  if (!comment) return 'not-found'
  if (comment.authorId !== userId && comment.post.authorId !== userId) {
    return 'forbidden'
  }
  await db.delete(comments).where(eq(comments.id, id))
  return 'ok'
}
