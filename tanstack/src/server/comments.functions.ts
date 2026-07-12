import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { addComment, deleteComment } from './comments'
import { requireUserId } from './session'

export const addCommentFn = createServerFn({ method: 'POST' })
  .validator((data: { postId: number; body: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const result = await addComment(userId, data.postId, data.body)
    if (result.status === 'not-found') throw notFound()
    if (result.status === 'invalid') return { errors: result.errors }
    return { ok: true as const }
  })

export const deleteCommentFn = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const result = await deleteComment(userId, data.id)
    if (result === 'not-found') throw notFound()
    if (result === 'forbidden') {
      throw new Error('Only the comment author or the post author can delete this comment.')
    }
    return { ok: true as const }
  })
