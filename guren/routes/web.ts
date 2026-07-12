import { Router, requireAuthenticated } from '@guren/core'
import CommentController from '../app/Http/Controllers/CommentController.js'
import PostController from '../app/Http/Controllers/PostController.js'
import { PostPayloadSchema } from '../app/Http/Validators/PostValidator.js'
import { CommentPayloadSchema } from '../app/Http/Validators/CommentValidator.js'
import { registerAuthRoutes } from './auth.js'

export function registerWebRoutes(router: Router): void {
  const web = router.aliasMiddleware('auth', requireAuthenticated({ redirectTo: '/login' }))

  registerAuthRoutes(web)

  web.get('/', (c) => c.redirect('/posts'))

  web.group('/posts', (posts) => {
    posts.get('/', [PostController, 'index']).name('posts.index')
    posts.get('/create', [PostController, 'create']).name('posts.create').middleware('auth')
    posts.get('/:id', [PostController, 'show']).name('posts.show')
    posts.get('/:id/edit', [PostController, 'edit']).name('posts.edit').middleware('auth')
    posts.post('/', { name: 'posts.store', body: PostPayloadSchema }, [PostController, 'store']).middleware('auth')
    posts.put('/:id', { name: 'posts.update', body: PostPayloadSchema }, [PostController, 'update']).middleware('auth')
    posts.delete('/:id', [PostController, 'destroy']).name('posts.destroy').middleware('auth')

    posts.post('/:id/comments', { name: 'comments.store', body: CommentPayloadSchema }, [CommentController, 'store']).middleware('auth')
    posts.delete('/:id/comments/:commentId', [CommentController, 'destroy']).name('comments.destroy').middleware('auth')
  })

  // Health check endpoint for load balancers and uptime monitors
  web.get('/health', (c) => c.json({ status: 'ok' }))
}
