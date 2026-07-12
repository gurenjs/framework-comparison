import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { UsersService, type SessionUser } from '../users/users.service';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  serializeUser(
    user: SessionUser,
    done: (err: Error | null, id: number) => void,
  ): void {
    done(null, user.id);
  }

  async deserializeUser(
    id: number,
    done: (err: Error | null, user: SessionUser | null) => void,
  ): Promise<void> {
    done(null, (await this.usersService.findById(id)) ?? null);
  }
}
