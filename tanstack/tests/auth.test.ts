import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, test } from 'vitest'

import { db } from '../src/db'
import { notifications, users } from '../src/db/schema'
import { registerUser, verifyCredentials } from '../src/server/auth'
import { flushDeferred, resetDb } from './helpers'

beforeEach(resetDb)

const alice = {
  name: 'Alice',
  email: 'alice@example.com',
  password: 'password123',
}

describe('register → login flow', () => {
  test('registers a user with a hashed password and verifies credentials', async () => {
    const result = await registerUser(alice)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return

    const row = await db.query.users.findFirst({
      where: eq(users.email, alice.email),
    })
    expect(row).toBeDefined()
    expect(row?.passwordHash).not.toContain(alice.password)

    const loggedIn = await verifyCredentials(alice.email, alice.password)
    expect(loggedIn).toMatchObject({ id: result.user.id, name: 'Alice' })
  })

  test('rejects a wrong password and an unknown email', async () => {
    await registerUser(alice)
    expect(await verifyCredentials(alice.email, 'wrong-password')).toBeNull()
    expect(await verifyCredentials('nobody@example.com', alice.password)).toBeNull()
  })

  test('rejects a duplicate email', async () => {
    await registerUser(alice)
    const result = await registerUser({ ...alice, name: 'Alice Again' })
    expect(result.status).toBe('invalid')
    if (result.status !== 'invalid') return
    expect(result.errors.email).toEqual(['This email is already registered.'])
  })

  test('returns per-field validation errors for invalid input', async () => {
    const result = await registerUser({
      name: '',
      email: 'not-an-email',
      password: 'short',
    })
    expect(result.status).toBe('invalid')
    if (result.status !== 'invalid') return
    expect(result.errors.name).toEqual(['Name is required.'])
    expect(result.errors.email).toEqual(['Enter a valid email address.'])
    expect(result.errors.password).toEqual([
      'Password must be at least 8 characters.',
    ])
  })

  test('rejects a name longer than 50 characters', async () => {
    const result = await registerUser({ ...alice, name: 'a'.repeat(51) })
    expect(result.status).toBe('invalid')
    if (result.status !== 'invalid') return
    expect(result.errors.name).toEqual(['Name must be at most 50 characters.'])
  })
})

describe('welcome notification (SPEC §5)', () => {
  test('is recorded outside the request/response critical path', async () => {
    const result = await registerUser(alice)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return

    // Not yet written when registration resolves…
    const before = await db.query.notifications.findMany({
      where: eq(notifications.userId, result.user.id),
    })
    expect(before).toHaveLength(0)

    // …but written shortly after, fire-and-forget.
    await flushDeferred()
    const after = await db.query.notifications.findMany({
      where: eq(notifications.userId, result.user.id),
    })
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ type: 'welcome' })
  })
})
