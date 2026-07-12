import User from '#models/user'
import Comment from '#models/comment'
import { PostSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class Post extends PostSchema {
  @belongsTo(() => User, { foreignKey: 'userId' })
  declare author: BelongsTo<typeof User>

  @hasMany(() => Comment)
  declare comments: HasMany<typeof Comment>
}
