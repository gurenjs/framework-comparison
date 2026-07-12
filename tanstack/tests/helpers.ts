import { db } from '../src/db'
import { comments, notifications, posts, users } from '../src/db/schema'
import type { PublicUser } from '../src/server/auth'

export async function resetDb(): Promise<void> {
  await db.delete(comments)
  await db.delete(notifications)
  await db.delete(posts)
  await db.delete(users)
}

let counter = 0

/** Inserts a user directly (no welcome notification side effect). */
export async function createUser(name = 'Alice'): Promise<PublicUser> {
  const [user] = await db
    .insert(users)
    .values({
      name,
      email: `user${++counter}@example.com`,
      passwordHash: 'irrelevant-for-these-tests',
    })
    .returning({ id: users.id, name: users.name, email: users.email })
  return user
}

/** Waits long enough for fire-and-forget deferred work to run. */
export function flushDeferred(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 25))
}
