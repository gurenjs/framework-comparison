import { redirect } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'

export type SessionData = {
  userId?: number
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production (32+ characters).')
  }
  return 'minilog-dev-only-session-secret-not-for-production'
}

/** Encrypted, HTTP-only cookie session (TanStack Start's `useSession`). */
export function useAppSession() {
  return useSession<SessionData>({
    name: 'minilog-session',
    password: sessionSecret(),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  })
}

/** Resolve the logged-in user's id, or redirect to the login page. */
export async function requireUserId(): Promise<number> {
  const session = await useAppSession()
  const { userId } = session.data
  if (!userId) throw redirect({ to: '/login' })
  return userId
}
