import type User from '#models/user'
import type Comment from '#models/comment'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class CommentPolicy extends BasePolicy {
  /**
   * A comment can be deleted by its author or by the post's author.
   * Expects the comment's post relationship to be preloaded.
   */
  delete(user: User, comment: Comment): AuthorizerResponse {
    return user.id === comment.userId || user.id === comment.post.userId
  }
}
