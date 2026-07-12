import { Job } from '@guren/core'
import { Notification } from '../Models/Notification.js'

export interface SendWelcomeNotificationJobPayload {
  userId: number
  name: string
}

export class SendWelcomeNotificationJob extends Job<SendWelcomeNotificationJobPayload> {
  static override queue = 'default'
  static override maxAttempts = 3

  async handle(payload: SendWelcomeNotificationJobPayload): Promise<void> {
    await Notification.create({
      userId: payload.userId,
      type: 'welcome',
      message: `Welcome to Minilog, ${payload.name}!`,
    })
  }

  async failed(payload: SendWelcomeNotificationJobPayload, error: Error): Promise<void> {
    console.error(`Welcome notification for user ${payload.userId} failed:`, error.message)
  }
}
