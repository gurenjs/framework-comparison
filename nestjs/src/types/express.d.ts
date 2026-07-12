import type { SessionUser } from '../users/users.service';

declare global {
  namespace Express {
    // Passport populates `request.user` with what the session serializer returns.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends SessionUser {}
  }
}
