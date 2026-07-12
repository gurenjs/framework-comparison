import Post from '#models/post'
import PostPolicy from '#policies/post_policy'
import { postValidator } from '#validators/post'
import PostTransformer from '#transformers/post_transformer'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  /**
   * Display a list of posts, newest first, 10 per page
   */
  async index({ request, inertia }: HttpContext) {
    const page = request.input('page', 1)
    const posts = await Post.query()
      .preload('author')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, 10)

    return inertia.render('posts/index', {
      posts: PostTransformer.paginate(posts.all(), posts.getMeta()),
    })
  }

  /**
   * Display form to create a new post
   */
  async create({ inertia }: HttpContext) {
    return inertia.render('posts/create', {})
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(postValidator)
    const post = await auth.getUserOrFail().related('posts').create(payload)

    return response.redirect().toRoute('posts.show', { id: post.id })
  }

  /**
   * Show an individual post with its comments
   */
  async show({ params, inertia }: HttpContext) {
    const post = await Post.query()
      .where('id', params.id)
      .preload('author')
      .preload('comments', (query) => query.preload('author').orderBy('created_at', 'asc'))
      .firstOrFail()

    return inertia.render('posts/show', {
      post: PostTransformer.transform(post),
    })
  }

  /**
   * Display form to edit an existing post
   */
  async edit({ params, bouncer, inertia }: HttpContext) {
    const post = await Post.findOrFail(params.id)
    await bouncer.with(PostPolicy).authorize('edit', post)

    return inertia.render('posts/edit', {
      post: PostTransformer.transform(post),
    })
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, response, bouncer }: HttpContext) {
    const post = await Post.findOrFail(params.id)
    await bouncer.with(PostPolicy).authorize('edit', post)

    const payload = await request.validateUsing(postValidator)
    await post.merge(payload).save()

    return response.redirect().toRoute('posts.show', { id: post.id })
  }

  /**
   * Delete a post
   */
  async destroy({ params, response, bouncer }: HttpContext) {
    const post = await Post.findOrFail(params.id)
    await bouncer.with(PostPolicy).authorize('delete', post)

    await post.delete()

    return response.redirect().toRoute('posts.index')
  }
}
