import { BaseTransformer } from '@adonisjs/core/transformers'
import Comment from '#models/comment'

export default class CommentTransformer extends BaseTransformer<Comment> {
  toObject() {
    return this.pick(this.resource, ['id'])
  }
}