import type UserRegistered from '#events/user_registered.ts'

export default class SendWelcomeNotification {
  async handle(event: UserRegistered) {}
}