import { isRedirect } from '@tanstack/react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { SessionData } from '../src/server/session'

// Stub TanStack Start's cookie-session primitive with an in-memory session so
// the auth guard can be exercised without an HTTP request context.
const sessionData: SessionData = {}

vi.mock('@tanstack/react-start/server', () => ({
  useSession: async () => ({
    id: 'test-session',
    data: sessionData,
    update: async (update: SessionData) => Object.assign(sessionData, update),
    clear: async () => {
      delete sessionData.userId
    },
  }),
}))

const { requireUserId, useAppSession } = await import('../src/server/session')

beforeEach(() => {
  delete sessionData.userId
})

describe('requireUserId (auth guard used by every mutating server function)', () => {
  test('redirects unauthenticated requests to the login page', async () => {
    const rejection = await requireUserId().then(
      () => null,
      (error: unknown) => error,
    )
    expect(isRedirect(rejection)).toBe(true)
  })

  test('returns the user id for a logged-in session', async () => {
    const session = await useAppSession()
    await session.update({ userId: 7 })
    expect(await requireUserId()).toBe(7)
  })

  test('rejects again after logout clears the session', async () => {
    const session = await useAppSession()
    await session.update({ userId: 7 })
    await session.clear()
    const rejection = await requireUserId().then(
      () => null,
      (error: unknown) => error,
    )
    expect(isRedirect(rejection)).toBe(true)
  })
})
