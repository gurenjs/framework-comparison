import { z } from 'zod'

export const CommentPayloadSchema = z.object({
  body: z.string().trim().min(1, 'Comment is required.').max(1_000, 'Comment must be 1,000 characters or fewer.'),
})

export const CommentPostParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const CommentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  commentId: z.coerce.number().int().positive(),
})
