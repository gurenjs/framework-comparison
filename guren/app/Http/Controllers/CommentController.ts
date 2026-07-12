import { Controller, AuthorizationException } from '@guren/core'
import { Comment } from '../../Models/Comment.js'
import { Post } from '../../Models/Post.js'
import type { UserRecord } from '../../Models/User.js'
import { CommentPayloadSchema, CommentPostParamSchema, CommentIdParamSchema } from '../Validators/CommentValidator.js'

export default class CommentController extends Controller {
  async store(): Promise<Response> {
    const { id } = this.validateParams(CommentPostParamSchema)
    const post = await Post.findOrFail(id)
    const data = await this.validateBody(CommentPayloadSchema)
    const user = await this.auth.userOrFail<UserRecord>()

    await Comment.create({ postId: post.id, userId: user.id, body: data.body })

    return this.redirect(`/posts/${post.id}`)
  }

  async destroy(): Promise<Response> {
    const { id, commentId } = this.validateParams(CommentIdParamSchema)
    const post = await Post.findOrFail(id)
    const comment = await Comment.findOrFail(commentId)
    const user = await this.auth.userOrFail<UserRecord>()

    // A comment can be removed by its author or by the post's author.
    if (comment.userId !== user.id && post.userId !== user.id) {
      throw new AuthorizationException('You cannot delete this comment.')
    }

    await Comment.delete({ id: commentId })

    return this.redirect(`/posts/${post.id}`)
  }
}
