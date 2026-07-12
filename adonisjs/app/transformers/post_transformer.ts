import type Post from '#models/post'
import { BaseTransformer } from '@adonisjs/core/transformers'
import UserTransformer from '#transformers/user_transformer'
import CommentTransformer from '#transformers/comment_transformer'

export default class PostTransformer extends BaseTransformer<Post> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'title', 'body', 'userId', 'createdAt']),
      author: UserTransformer.transform(this.whenLoaded(this.resource.author)),
      comments: CommentTransformer.transform(this.whenLoaded(this.resource.comments))?.depth(2),
    }
  }
}
