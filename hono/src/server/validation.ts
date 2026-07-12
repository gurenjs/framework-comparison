import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import { z } from 'zod'

/**
 * zValidator with a shared hook: invalid input returns 422 with
 * per-field error messages, e.g. { errors: { title: ['…'] } }.
 */
export const validate = <T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json({ errors: z.flattenError(result.error).fieldErrors }, 422)
    }
  })

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(50, 'Name must be at most 50 characters'),
  email: z.email('Must be a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const loginSchema = z.object({
  email: z.email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const postSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(120, 'Title must be at most 120 characters'),
  body: z
    .string()
    .trim()
    .min(1, 'Body is required')
    .max(10_000, 'Body must be at most 10,000 characters'),
})

export const commentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Comment is required')
    .max(1_000, 'Comment must be at most 1,000 characters'),
})
