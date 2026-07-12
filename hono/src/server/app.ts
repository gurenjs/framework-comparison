import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { sessionUser } from './auth/middleware'
import type { Db } from './db'
import { authRoutes } from './routes/auth'
import { commentRoutes } from './routes/comments'
import { postRoutes } from './routes/posts'
import type { AppEnv } from './types'

export function createApp(db: Db) {
  return new Hono<AppEnv>()
    .use(csrf())
    .use(async (c, next) => {
      c.set('db', db)
      await next()
    })
    .use(sessionUser)
    .route('/api/auth', authRoutes)
    .route('/api/posts', postRoutes)
    .route('/api/comments', commentRoutes)
}
