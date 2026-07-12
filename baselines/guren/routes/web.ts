import { Router } from '@guren/core'
import HomeController from '../app/Http/Controllers/HomeController.js'
import { registerAuthRoutes } from './auth.js'

export function registerWebRoutes(router: Router): void {
  registerAuthRoutes(router)
  router.get('/', [HomeController, 'index'])

  // Health check endpoint for load balancers and uptime monitors
  router.get('/health', (c) => c.json({ status: 'ok' }))
}
