import User from '#models/user'
import Post from '#models/post'
import { CommentSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Comment extends CommentSchema {
  @belongsTo(() => User, { foreignKey: 'userId' })
  declare author: BelongsTo<typeof User>

  @belongsTo(() => Post)
  declare post: BelongsTo<typeof Post>
}
