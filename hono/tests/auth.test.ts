import { describe, expect, test } from 'bun:test'
import { notifications } from '../src/server/db/schema'
import { createTestApp, json, register, sessionCookie } from './helpers'

describe('authentication', () => {
  test('register → login → logout flow', async () => {
    const { app } = createTestApp()

    const registerRes = await app.request(
      '/api/auth/register',
      json('POST', { name: 'Alice', email: 'alice@example.com', password: 'password123' }),
    )
    expect(registerRes.status).toBe(201)
    const { user } = (await registerRes.json()) as { user: Record<string, unknown> }
    expect(user).toEqual({ id: expect.any(Number), name: 'Alice', email: 'alice@example.com' })
    expect(user).not.toHaveProperty('passwordHash')

    const loginRes = await app.request(
      '/api/auth/login',
      json('POST', { email: 'alice@example.com', password: 'password123' }),
    )
    expect(loginRes.status).toBe(200)
    const cookie = sessionCookie(loginRes)

    const meRes = await app.request('/api/auth/me', { headers: { Cookie: cookie } })
    expect(((await meRes.json()) as { user: { name: string } }).user.name).toBe('Alice')

    const logoutRes = await app.request('/api/auth/logout', json('POST', {}, cookie))
    expect(logoutRes.status).toBe(204)

    const meAfter = await app.request('/api/auth/me', { headers: { Cookie: cookie } })
    expect(((await meAfter.json()) as { user: unknown }).user).toBeNull()
  })

  test('login with wrong password is rejected', async () => {
    const { app } = createTestApp()
    await register(app)

    const res = await app.request(
      '/api/auth/login',
      json('POST', { email: 'alice@example.com', password: 'wrong-password' }),
    )
    expect(res.status).toBe(401)
  })

  test('registering with a taken email returns a field error', async () => {
    const { app } = createTestApp()
    await register(app)

    const res = await app.request(
      '/api/auth/register',
      json('POST', { name: 'Bob', email: 'alice@example.com', password: 'password123' }),
    )
    expect(res.status).toBe(422)
    const { errors } = (await res.json()) as { errors: Record<string, string[]> }
    expect(errors.email).toEqual(['Email is already taken'])
  })

  test('registration records a welcome notification outside the request path', async () => {
    const { app, db } = createTestApp()
    const { userId } = await register(app)

    // The notification is written fire-and-forget after the response is sent.
    await Bun.sleep(20)
    const rows = await db.select().from(notifications)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ userId, type: 'welcome' })
  })
})
