import { z } from 'zod'

export const PostIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const ListPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
})

export const PostPayloadSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
})

export type PostPayload = z.infer<typeof PostPayloadSchema>
