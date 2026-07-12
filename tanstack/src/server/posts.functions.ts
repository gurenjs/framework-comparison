import { notFound, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { createPost, deletePost, getPost, listPosts, updatePost } from './posts'
import { requireUserId } from './session'

export const listPostsFn = createServerFn()
  .validator((data: { page: number }) => data)
  .handler(({ data }) => listPosts(data.page))

export const getPostFn = createServerFn()
  .validator((data: { id: number }) => data)
  .handler(({ data }) => getPost(data.id))

export const createPostFn = createServerFn({ method: 'POST' })
  .validator((data: { title: string; body: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const result = await createPost(userId, data)
    if (result.status === 'invalid') return { errors: result.errors }
    throw redirect({
      to: '/posts/$postId',
      params: { postId: String(result.post.id) },
    })
  })

export const updatePostFn = createServerFn({ method: 'POST' })
  .validator((data: { id: number; title: string; body: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const result = await updatePost(userId, data.id, {
      title: data.title,
      body: data.body,
    })
    if (result.status === 'not-found') throw notFound()
    if (result.status === 'forbidden') {
      throw new Error('Only the author can edit this post.')
    }
    if (result.status === 'invalid') return { errors: result.errors }
    throw redirect({
      to: '/posts/$postId',
      params: { postId: String(result.post.id) },
    })
  })

export const deletePostFn = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const result = await deletePost(userId, data.id)
    if (result === 'not-found') throw notFound()
    if (result === 'forbidden') {
      throw new Error('Only the author can delete this post.')
    }
    throw redirect({ to: '/' })
  })
