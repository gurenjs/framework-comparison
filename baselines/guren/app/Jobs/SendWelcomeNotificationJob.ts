import { Job } from '@guren/core'

export interface SendWelcomeNotificationJobPayload {
  [key: string]: unknown
}

export class SendWelcomeNotificationJob extends Job<SendWelcomeNotificationJobPayload> {
  static override queue = 'default'
  static override maxAttempts = 3

  async handle(payload: SendWelcomeNotificationJobPayload): Promise<void> {
    void payload
  }

  async failed(payload: SendWelcomeNotificationJobPayload, error: Error): Promise<void> {
    void payload
    console.error('SendWelcomeNotificationJob failed:', error.message)
  }
}
