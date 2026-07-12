import Post from '#models/post'
import Comment from '#models/comment'
import CommentPolicy from '#policies/comment_policy'
import { commentValidator } from '#validators/comment'
import type { HttpContext } from '@adonisjs/core/http'

export default class CommentsController {
  /**
   * Add a comment to a post
   */
  async store({ params, request, response, auth }: HttpContext) {
    const post = await Post.findOrFail(params.postId)
    const payload = await request.validateUsing(commentValidator)

    await post.related('comments').create({
      ...payload,
      userId: auth.getUserOrFail().id,
    })

    return response.redirect().toRoute('posts.show', { id: post.id })
  }

  /**
   * Delete a comment (allowed for its author or the post's author)
   */
  async destroy({ params, response, bouncer }: HttpContext) {
    const comment = await Comment.query().where('id', params.id).preload('post').firstOrFail()
    await bouncer.with(CommentPolicy).authorize('delete', comment)

    await comment.delete()

    return response.redirect().toRoute('posts.show', { id: comment.postId })
  }
}
