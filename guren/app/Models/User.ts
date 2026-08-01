import { AuthenticatableModel, defineModel } from '@guren/core'
import { users } from '../../db/schema.js'

export type UserRecord = typeof users.$inferSelect

export class User extends defineModel(users, {
  base: AuthenticatableModel,
  // Derived from the plain `password`, so callers never set it directly
  optionalOnCreate: ['passwordHash'],
  requireOnCreate: ['password'],
}) {
  // passwordHash and rememberToken are denied from mass assignment by
  // AuthenticatableModel itself — no per-model configuration needed.

  // Never serialized by Model.serialize() and stripped from auth.user()
  static override hidden = ['passwordHash', 'rememberToken']
}
