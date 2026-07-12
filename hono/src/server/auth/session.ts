import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Db } from '../db'
import { sessions } from '../db/schema'
import type { AppEnv, SessionUser } from '../types'

const COOKIE_NAME = 'minilog_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Buffer.from(bytes).toString('hex')
}

export async function startSession(c: Context<AppEnv>, db: Db, userId: number): Promise<void> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(sessions).values({ token, userId, expiresAt })
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
  })
}

export async function endSession(c: Context<AppEnv>, db: Db): Promise<void> {
  const token = getCookie(c, COOKIE_NAME)
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token))
  }
  deleteCookie(c, COOKIE_NAME, { path: '/' })
}

export async function resolveSessionUser(c: Context<AppEnv>, db: Db): Promise<SessionUser | null> {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) return null
  const session = await db.query.sessions.findFirst({ where: eq(sessions.token, token) })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.token, token))
    return null
  }
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.userId),
    columns: { id: true, name: true, email: true },
  })
  return user ?? null
}
