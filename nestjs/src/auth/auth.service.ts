import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { compare } from 'bcryptjs';
import { UsersService, type SessionUser } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { UserRegisteredEvent } from './user-registered.event';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterDto): Promise<SessionUser> {
    if (await this.usersService.findByEmail(dto.email)) {
      throw new UnprocessableEntityException({
        errors: { email: ['Email is already taken'] },
      });
    }
    const user = await this.usersService.create(dto);
    this.eventEmitter.emit(
      UserRegisteredEvent.eventName,
      new UserRegisteredEvent(user.id, user.name),
    );
    return user;
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<SessionUser | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await compare(password, user.passwordHash))) {
      return null;
    }
    return { id: user.id, name: user.name, email: user.email };
  }
}
