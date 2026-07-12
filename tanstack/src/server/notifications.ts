import { db } from '../db'
import { notifications } from '../db/schema'

/**
 * Records the welcome notification outside the request/response critical
 * path: the row is written fire-and-forget on the next macrotask, after the
 * registration response has been produced (SPEC §5).
 */
export function queueWelcomeNotification(userId: number): void {
  setTimeout(async () => {
    try {
      await db.insert(notifications).values({
        userId,
        type: 'welcome',
        message: 'Welcome to Minilog!',
      })
    } catch (error) {
      console.error('Failed to record welcome notification', error)
    }
  }, 0)
}
