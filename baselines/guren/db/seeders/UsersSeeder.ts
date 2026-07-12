import { defineSeeder, ScryptHasher } from '@guren/core'
import { users } from '../schema.js'

export default defineSeeder(async ({ db }) => {
  const hasher = new ScryptHasher()
  const passwordHash = await hasher.hash('secret')

  await db
    .insert(users)
    .values([
      {
        name: 'Demo User',
        email: 'demo@example.com',
        passwordHash,
      },
    ])
    .onConflictDoNothing({ target: users.email })
})
