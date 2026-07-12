import { z } from 'zod'

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .email('The email address is badly formatted.'),
  password: z
    .string()
    .min(1, 'Password is required.'),
  remember: z
    .union([
      z.boolean(),
      z
        .string()
        .transform((value) => ['true', 'on', '1'].includes(value.toLowerCase())),
    ])
    .optional()
    .transform((value) => Boolean(value))
    .default(false),
})

export type LoginInput = z.infer<typeof LoginSchema>
