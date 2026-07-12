import { Inject, Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Drizzle } from '../database/database';
import { users } from '../database/schema';

/** The user shape stored on the request by Passport (never the hash). */
export interface SessionUser {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

  findByEmail(email: string) {
    return this.db.query.users.findFirst({ where: eq(users.email, email) });
  }

  findById(id: number): Promise<SessionUser | undefined> {
    return this.db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { id: true, name: true, email: true },
    });
  }

  async create(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<SessionUser> {
    const passwordHash = await hash(data.password, 10);
    const [user] = await this.db
      .insert(users)
      .values({ name: data.name, email: data.email, passwordHash })
      .returning({ id: users.id, name: users.name, email: users.email });
    return user;
  }
}
