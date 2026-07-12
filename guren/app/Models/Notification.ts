import { defineModel } from '@guren/core'
import { notifications } from '../../db/schema.js'

export type NotificationRecord = typeof notifications.$inferSelect

export class Notification extends defineModel(notifications) {
  static fillable = ['userId', 'type', 'message']
}
