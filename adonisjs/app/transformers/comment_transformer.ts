import type Comment from '#models/comment'
import { BaseTransformer } from '@adonisjs/core/transformers'
import UserTransformer from '#transformers/user_transformer'

export default class CommentTransformer extends BaseTransformer<Comment> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'body', 'userId', 'postId', 'createdAt']),
      author: UserTransformer.transform(this.whenLoaded(this.resource.author)),
    }
  }
}
