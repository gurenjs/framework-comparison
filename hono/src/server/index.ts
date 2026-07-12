import { serveStatic } from 'hono/bun'
import { createApp } from './app'
import { createDb } from './db'

const db = createDb(process.env.DATABASE_PATH ?? 'minilog.db')
const app = createApp(db)

// In production the built SPA is served by the same process; in development
// Vite serves the client and proxies /api to this server.
if (process.env.NODE_ENV === 'production') {
  app.use('*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
}
