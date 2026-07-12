import Notification from '#models/notification'
import type UserRegistered from '#events/user_registered'

export default class SendWelcomeNotification {
  async handle(event: UserRegistered) {
    await Notification.create({
      userId: event.user.id,
      type: 'welcome',
      body: `Welcome to Minilog, ${event.user.fullName}!`,
    })
  }
}
