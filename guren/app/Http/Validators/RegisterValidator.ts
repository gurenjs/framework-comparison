import { z } from 'zod'

export const RegisterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(50, 'Name must be 50 characters or fewer.'),
  email: z.string().trim().min(1, 'Email is required.').email('The email address is badly formatted.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
