import { Router, requireAuthenticated, requireGuest } from '@guren/core'
import LoginController from '../app/Http/Controllers/Auth/LoginController.js'
import DashboardController from '../app/Http/Controllers/DashboardController.js'
import ProfileController from '../app/Http/Controllers/ProfileController.js'

export function registerAuthRoutes(router: Router): void {
  router.get('/login', [LoginController, 'show'], requireGuest({ redirectTo: '/dashboard' })).name('login')
  router.post('/login', [LoginController, 'store'], requireGuest({ redirectTo: '/dashboard' })).name('login.store')
  router.post('/logout', [LoginController, 'destroy'], requireAuthenticated({ redirectTo: '/login' })).name('logout')

  router.get('/dashboard', [DashboardController, 'index'], requireAuthenticated({ redirectTo: '/login' })).name('dashboard')
  router.get('/profile', [ProfileController, 'edit'], requireAuthenticated({ redirectTo: '/login' })).name('profile.edit')
  router.put('/profile', [ProfileController, 'update'], requireAuthenticated({ redirectTo: '/login' })).name('profile.update')
}
