import { defineModel, type BelongsToRecord, type HasManyRecord } from '@guren/core'
import { posts } from '../../db/schema.js'
import type { CommentRecord } from './Comment.js'
import type { UserRecord } from './User.js'

export type PostRecord = typeof posts.$inferSelect
export type NewPostRecord = typeof posts.$inferInsert
export type PostAuthor = Pick<UserRecord, 'id' | 'name'>

export class Post extends defineModel(posts) {
  static fillable = ['title', 'body', 'userId']

  static override relationTypes: {
    author: BelongsToRecord<PostAuthor>
    comments: HasManyRecord<CommentRecord>
  } = {
    author: null,
    comments: [],
  }
}

Post.belongsTo('author', () => import('./User.js').then((m) => m.User), 'userId', 'id')
Post.hasMany('comments', () => import('./Comment.js').then((m) => m.Comment), 'postId', 'id')
