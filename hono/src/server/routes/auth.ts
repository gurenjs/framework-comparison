import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { users } from '../db/schema'
import { requireAuth } from '../auth/middleware'
import { endSession, startSession } from '../auth/session'
import { enqueueWelcomeNotification } from '../notifications'
import type { AppEnv } from '../types'
import { loginSchema, registerSchema, validate } from '../validation'

export const authRoutes = new Hono<AppEnv>()
  .post('/register', validate('json', registerSchema), async (c) => {
    const { name, email, password } = c.req.valid('json')
    const db = c.var.db

    const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (existing) {
      return c.json({ errors: { email: ['Email is already taken'] } }, 422)
    }

    const passwordHash = await Bun.password.hash(password)
    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash })
      .returning({ id: users.id, name: users.name, email: users.email })
    if (!user) throw new Error('Failed to create user')

    enqueueWelcomeNotification(db, user.id, user.name)
    await startSession(c, db, user.id)
    return c.json({ user }, 201)
  })

  .post('/login', validate('json', loginSchema), async (c) => {
    const { email, password } = c.req.valid('json')
    const db = c.var.db

    const user = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (!user || !(await Bun.password.verify(password, user.passwordHash))) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }

    await startSession(c, db, user.id)
    return c.json({ user: { id: user.id, name: user.name, email: user.email } })
  })

  .post('/logout', requireAuth, async (c) => {
    await endSession(c, c.var.db)
    return c.body(null, 204)
  })

  .get('/me', (c) => c.json({ user: c.var.user }))
