import { z } from 'zod'

export const PostIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const ListPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
})

export const PostPayloadSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120, 'Title must be 120 characters or fewer.'),
  body: z.string().trim().min(1, 'Body is required.').max(10_000, 'Body must be 10,000 characters or fewer.'),
})

export type PostPayload = z.infer<typeof PostPayloadSchema>
