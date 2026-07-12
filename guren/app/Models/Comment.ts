import { defineModel, type BelongsToRecord } from '@guren/core'
import { comments } from '../../db/schema.js'
import type { PostRecord } from './Post.js'
import type { UserRecord } from './User.js'

export type CommentRecord = typeof comments.$inferSelect

export class Comment extends defineModel(comments) {
  static fillable = ['postId', 'userId', 'body']

  static override relationTypes: {
    post: BelongsToRecord<PostRecord>
    author: BelongsToRecord<Pick<UserRecord, 'id' | 'name'>>
  } = {
    post: null,
    author: null,
  }
}

Comment.belongsTo('post', () => import('./Post.js').then((m) => m.Post), 'postId', 'id')
Comment.belongsTo('author', () => import('./User.js').then((m) => m.User), 'userId', 'id')
