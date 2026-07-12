import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types'
import { resolveSessionUser } from './session'

/** Loads the current user from the session cookie into `c.var.user`. */
export const sessionUser = createMiddleware<AppEnv>(async (c, next) => {
  c.set('user', await resolveSessionUser(c, c.var.db))
  await next()
})

/** Rejects unauthenticated requests with 401. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  await next()
})
