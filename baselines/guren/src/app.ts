import { createApp } from '@guren/core'
import DatabaseProvider from '../app/Providers/DatabaseProvider.js'
import { registerWebRoutes } from '../routes/web.js'
import AuthProvider from '../app/Providers/AuthProvider.js'

const app = createApp({
  auth: {},
  routes: registerWebRoutes,
  providers: [DatabaseProvider, AuthProvider],
  hostAuthorization: process.env.NODE_ENV === 'production' ? false : {
    allowedHosts: ['localhost:*', '127.0.0.1:*'],
    exclude: ['/healthcheck', '/up'],
  },
})

export default app
