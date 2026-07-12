import { count, desc, eq } from 'drizzle-orm'

import { db } from '../db'
import { posts, users } from '../db/schema'
import { PostSchema, fieldErrors, type FieldErrors } from './validation'

export const POSTS_PER_PAGE = 10

export type PostInput = { title: string; body: string }

export type PostMutationResult =
  | { status: 'not-found' }
  | { status: 'forbidden' }
  | { status: 'invalid'; errors: FieldErrors }
  | { status: 'ok'; post: typeof posts.$inferSelect }

export async function listPosts(page: number) {
  const current = Math.max(1, Math.trunc(page) || 1)
  const [row] = await db.select({ total: count() }).from(posts)
  const total = row.total
  const pageCount = Math.max(1, Math.ceil(total / POSTS_PER_PAGE))
  const items = await db
    .select({
      id: posts.id,
      title: posts.title,
      createdAt: posts.createdAt,
      authorName: users.name,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(POSTS_PER_PAGE)
    .offset((current - 1) * POSTS_PER_PAGE)
  return { items, page: current, pageCount, total }
}

export async function getPost(id: number) {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: {
      author: { columns: { id: true, name: true } },
      comments: {
        with: { author: { columns: { id: true, name: true } } },
        orderBy: (comments, { asc }) => [asc(comments.createdAt), asc(comments.id)],
      },
    },
  })
  return post ?? null
}

export async function createPost(
  authorId: number,
  input: PostInput,
): Promise<Exclude<PostMutationResult, { status: 'not-found' | 'forbidden' }>> {
  const parsed = PostSchema.safeParse(input)
  if (!parsed.success) {
    return { status: 'invalid', errors: fieldErrors(parsed.error) }
  }
  const [post] = await db
    .insert(posts)
    .values({ ...parsed.data, authorId })
    .returning()
  return { status: 'ok', post }
}

export async function updatePost(
  userId: number,
  id: number,
  input: PostInput,
): Promise<PostMutationResult> {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, id) })
  if (!post) return { status: 'not-found' }
  if (post.authorId !== userId) return { status: 'forbidden' }

  const parsed = PostSchema.safeParse(input)
  if (!parsed.success) {
    return { status: 'invalid', errors: fieldErrors(parsed.error) }
  }
  const [updated] = await db
    .update(posts)
    .set(parsed.data)
    .where(eq(posts.id, id))
    .returning()
  return { status: 'ok', post: updated }
}

export async function deletePost(
  userId: number,
  id: number,
): Promise<'not-found' | 'forbidden' | 'ok'> {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, id) })
  if (!post) return 'not-found'
  if (post.authorId !== userId) return 'forbidden'
  await db.delete(posts).where(eq(posts.id, id))
  return 'ok'
}
