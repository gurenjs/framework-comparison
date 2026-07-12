import { asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireAuth } from '../auth/middleware'
import { comments, posts } from '../db/schema'
import type { AppEnv } from '../types'
import { commentSchema, postSchema, validate } from '../validation'

const PER_PAGE = 10

const authorColumns = { columns: { id: true, name: true } } as const

export const postRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const db = c.var.db
    const page = Math.max(1, Number(c.req.query('page')) || 1)
    const [items, total] = await Promise.all([
      db.query.posts.findMany({
        columns: { id: true, title: true, body: true, createdAt: true },
        with: { author: authorColumns },
        orderBy: [desc(posts.createdAt), desc(posts.id)],
        limit: PER_PAGE,
        offset: (page - 1) * PER_PAGE,
      }),
      db.$count(posts),
    ])
    return c.json({
      posts: items,
      pagination: { page, perPage: PER_PAGE, total, totalPages: Math.ceil(total / PER_PAGE) },
    })
  })

  .get('/:id', async (c) => {
    const post = await findPost(c.var.db, c.req.param('id'))
    if (!post) return c.json({ error: 'Post not found' }, 404)
    return c.json({ post })
  })

  .post('/', requireAuth, validate('json', postSchema), async (c) => {
    const data = c.req.valid('json')
    const [post] = await c.var.db
      .insert(posts)
      .values({ ...data, authorId: c.var.user!.id })
      .returning()
    if (!post) throw new Error('Failed to create post')
    return c.json({ post }, 201)
  })

  .put('/:id', requireAuth, validate('json', postSchema), async (c) => {
    const db = c.var.db
    const post = await findPost(db, c.req.param('id'))
    if (!post) return c.json({ error: 'Post not found' }, 404)
    if (post.author.id !== c.var.user!.id) {
      return c.json({ error: 'Only the author can edit this post' }, 403)
    }
    const data = c.req.valid('json')
    const [updated] = await db.update(posts).set(data).where(eq(posts.id, post.id)).returning()
    return c.json({ post: updated })
  })

  .delete('/:id', requireAuth, async (c) => {
    const db = c.var.db
    const post = await findPost(db, c.req.param('id'))
    if (!post) return c.json({ error: 'Post not found' }, 404)
    if (post.author.id !== c.var.user!.id) {
      return c.json({ error: 'Only the author can delete this post' }, 403)
    }
    await db.delete(posts).where(eq(posts.id, post.id))
    return c.body(null, 204)
  })

  .post('/:id/comments', requireAuth, validate('json', commentSchema), async (c) => {
    const db = c.var.db
    const post = await findPost(db, c.req.param('id'))
    if (!post) return c.json({ error: 'Post not found' }, 404)
    const { body } = c.req.valid('json')
    const [comment] = await db
      .insert(comments)
      .values({ body, postId: post.id, authorId: c.var.user!.id })
      .returning()
    if (!comment) throw new Error('Failed to create comment')
    return c.json({ comment }, 201)
  })

function findPost(db: AppEnv['Variables']['db'], idParam: string) {
  const id = Number(idParam)
  if (!Number.isInteger(id)) return Promise.resolve(undefined)
  return db.query.posts.findFirst({
    where: eq(posts.id, id),
    columns: { id: true, title: true, body: true, createdAt: true },
    with: {
      author: authorColumns,
      comments: {
        columns: { id: true, body: true, createdAt: true },
        with: { author: authorColumns },
        orderBy: [asc(comments.createdAt), asc(comments.id)],
      },
    },
  })
}
