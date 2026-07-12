import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireAuth } from '../auth/middleware'
import { comments } from '../db/schema'
import type { AppEnv } from '../types'

export const commentRoutes = new Hono<AppEnv>().delete('/:id', requireAuth, async (c) => {
  const db = c.var.db
  const id = Number(c.req.param('id'))
  const comment = Number.isInteger(id)
    ? await db.query.comments.findFirst({
        where: eq(comments.id, id),
        with: { post: { columns: { authorId: true } } },
      })
    : undefined
  if (!comment) return c.json({ error: 'Comment not found' }, 404)

  const userId = c.var.user!.id
  if (comment.authorId !== userId && comment.post.authorId !== userId) {
    return c.json({ error: 'Only the comment author or the post author can delete this comment' }, 403)
  }

  await db.delete(comments).where(eq(comments.id, id))
  return c.body(null, 204)
})
