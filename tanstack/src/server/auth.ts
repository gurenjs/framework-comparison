import { eq } from 'drizzle-orm'

import { db } from '../db'
import { users } from '../db/schema'
import { queueWelcomeNotification } from './notifications'
import { hashPassword, verifyPassword } from './password'
import { RegisterSchema, fieldErrors, type FieldErrors } from './validation'

export type PublicUser = {
  id: number
  name: string
  email: string
}

export type RegisterResult =
  | { status: 'invalid'; errors: FieldErrors }
  | { status: 'ok'; user: PublicUser }

export async function registerUser(input: {
  name: string
  email: string
  password: string
}): Promise<RegisterResult> {
  const parsed = RegisterSchema.safeParse(input)
  if (!parsed.success) {
    return { status: 'invalid', errors: fieldErrors(parsed.error) }
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  })
  if (existing) {
    return {
      status: 'invalid',
      errors: { email: ['This email is already registered.'] },
    }
  }

  const passwordHash = await hashPassword(parsed.data.password)
  const [user] = await db
    .insert(users)
    .values({ name: parsed.data.name, email: parsed.data.email, passwordHash })
    .returning({ id: users.id, name: users.name, email: users.email })

  queueWelcomeNotification(user.id)
  return { status: 'ok', user }
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (!user) return null
  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid) return null
  return { id: user.id, name: user.name, email: user.email }
}

export async function getUserById(id: number): Promise<PublicUser | null> {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) })
  if (!user) return null
  return { id: user.id, name: user.name, email: user.email }
}
