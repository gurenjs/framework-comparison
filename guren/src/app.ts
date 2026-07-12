import { createApp, getGate, MemoryQueueDriver, registerJob, setQueueDriver, Worker } from '@guren/core'
import DatabaseProvider from '../app/Providers/DatabaseProvider.js'
import AuthProvider from '../app/Providers/AuthProvider.js'
import { SendWelcomeNotificationJob } from '../app/Jobs/SendWelcomeNotificationJob.js'
import { Post } from '../app/Models/Post.js'
import { PostPolicy } from '../app/Policies/PostPolicy.js'
import { registerWebRoutes } from '../routes/web.js'

const app = createApp({
  auth: {},
  routes: registerWebRoutes,
  providers: [DatabaseProvider, AuthProvider],
  hostAuthorization: process.env.NODE_ENV === 'production' ? false : {
    allowedHosts: ['localhost:*', '127.0.0.1:*'],
    exclude: ['/healthcheck', '/up'],
  },
  boot: () => {
    getGate().policy(Post, PostPolicy)

    registerJob(SendWelcomeNotificationJob)
    const queue = new MemoryQueueDriver()
    setQueueDriver(queue)
    if (!process.env.GUREN_TESTING) {
      void new Worker(queue).start()
    }
  },
})

export default app
