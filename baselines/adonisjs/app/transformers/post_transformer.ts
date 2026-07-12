import { BaseTransformer } from '@adonisjs/core/transformers'
import Post from '#models/post'

export default class PostTransformer extends BaseTransformer<Post> {
  toObject() {
    return this.pick(this.resource, ['id'])
  }
}