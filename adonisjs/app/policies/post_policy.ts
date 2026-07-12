import type User from '#models/user'
import type Post from '#models/post'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class PostPolicy extends BasePolicy {
  /**
   * Only the post's author can edit it
   */
  edit(user: User, post: Post): AuthorizerResponse {
    return user.id === post.userId
  }

  /**
   * Only the post's author can delete it
   */
  delete(user: User, post: Post): AuthorizerResponse {
    return user.id === post.userId
  }
}
