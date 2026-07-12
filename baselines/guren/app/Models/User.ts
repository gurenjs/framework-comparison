import { AuthenticatableModel } from '@guren/core'
import { users } from '../../db/schema.js'

export type UserRecord = typeof users.$inferSelect

export class User extends AuthenticatableModel<UserRecord> {
  static override table = users
  static override readonly recordType = {} as UserRecord

  // Never serialized by Model.serialize() and stripped from auth.user()
  static override hidden = ['passwordHash', 'rememberToken']
}
