import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserRegisteredEvent } from '../auth/user-registered.event';
import { DRIZZLE, type Drizzle } from '../database/database';
import { notifications } from '../database/schema';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

  /**
   * Records the welcome notification outside the request/response critical
   * path: `async: true` defers the listener, so the registration response
   * never waits for this write. Failures are logged, never surfaced.
   */
  @OnEvent(UserRegisteredEvent.eventName, { async: true })
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    try {
      await this.db.insert(notifications).values({
        userId: event.userId,
        type: 'welcome',
        body: `Welcome to Minilog, ${event.name}!`,
      });
    } catch (error) {
      this.logger.error('Failed to record welcome notification', error);
    }
  }
}
