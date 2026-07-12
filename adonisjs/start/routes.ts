/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router.get('/', ({ response }) => response.redirect().toRoute('posts.index')).as('home')

router
  .resource('posts', controllers.Posts)
  .use(['create', 'store', 'edit', 'update', 'destroy'], middleware.auth())

router
  .group(() => {
    router.post('posts/:postId/comments', [controllers.Comments, 'store']).as('comments.store')
    router.delete('comments/:id', [controllers.Comments, 'destroy']).as('comments.destroy')
  })
  .use(middleware.auth())

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())
