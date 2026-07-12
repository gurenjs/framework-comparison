import { type Router, requireAuthenticated, requireGuest } from '@guren/core'
import LoginController from '../app/Http/Controllers/Auth/LoginController.js'
import RegisterController from '../app/Http/Controllers/Auth/RegisterController.js'

export function registerAuthRoutes(router: Router<'auth'>): void {
  router.get('/register', [RegisterController, 'show'], requireGuest({ redirectTo: '/posts' })).name('register')
  router.post('/register', [RegisterController, 'store'], requireGuest({ redirectTo: '/posts' })).name('register.store')

  router.get('/login', [LoginController, 'show'], requireGuest({ redirectTo: '/posts' })).name('login')
  router.post('/login', [LoginController, 'store'], requireGuest({ redirectTo: '/posts' })).name('login.store')
  router.post('/logout', [LoginController, 'destroy'], requireAuthenticated({ redirectTo: '/login' })).name('logout')
}
