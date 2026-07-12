import type { Db } from './db'
import { notifications } from './db/schema'

/**
 * Records a welcome notification outside the request/response critical path.
 * Fire-and-forget: the registration response is sent without waiting for this
 * write; failures are logged, never surfaced to the client.
 */
export function enqueueWelcomeNotification(db: Db, userId: number, name: string): void {
  setTimeout(async () => {
    try {
      await db.insert(notifications).values({
        userId,
        type: 'welcome',
        body: `Welcome to Minilog, ${name}!`,
      })
    } catch (error) {
      console.error('Failed to record welcome notification', error)
    }
  }, 0)
}
