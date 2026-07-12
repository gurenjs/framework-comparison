import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DRIZZLE, type Drizzle } from '../src/database/database';
import { notifications, users } from '../src/database/schema';
import { eq } from 'drizzle-orm';
import { createTestApp, register, sessionCookie, sleep } from './helpers';

describe('authentication', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('register → login → logout flow', async () => {
    const server = app.getHttpServer();

    const registerRes = await request(server).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(registerRes.status).toBe(201);
    const { user } = registerRes.body as { user: Record<string, unknown> };
    expect(user).toEqual({
      id: expect.any(Number) as number,
      name: 'Alice',
      email: 'alice@example.com',
    });
    expect(user).not.toHaveProperty('passwordHash');

    const loginRes = await request(server)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });
    expect(loginRes.status).toBe(200);
    const cookie = sessionCookie(loginRes);

    const meRes = await request(server)
      .get('/api/auth/me')
      .set('Cookie', cookie);
    expect((meRes.body as { user: { name: string } }).user.name).toBe('Alice');

    const logoutRes = await request(server)
      .post('/api/auth/logout')
      .set('Cookie', cookie);
    expect(logoutRes.status).toBe(204);

    const meAfter = await request(server)
      .get('/api/auth/me')
      .set('Cookie', cookie);
    expect((meAfter.body as { user: unknown }).user).toBeNull();
  });

  it('login with wrong password is rejected', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('registering with a taken email returns a field error', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Bob',
        email: 'alice@example.com',
        password: 'password123',
      });
    expect(res.status).toBe(422);
    const { errors } = res.body as { errors: Record<string, string[]> };
    expect(errors.email).toEqual(['Email is already taken']);
  });

  it('registration records a welcome notification outside the request path', async () => {
    const { userId } = await register(app, {
      name: 'Dave',
      email: 'dave@example.com',
    });

    // The listener runs deferred (`@OnEvent(..., { async: true })`).
    await sleep(50);
    const db = app.get<Drizzle>(DRIZZLE);
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId, type: 'welcome' });
  });

  it('stores passwords hashed, never in plain text', async () => {
    const db = app.get<Drizzle>(DRIZZLE);
    const row = await db.query.users.findFirst({
      where: eq(users.email, 'alice@example.com'),
    });
    expect(row).toBeDefined();
    expect(row?.passwordHash).not.toBe('password123');
    expect(row?.passwordHash).toMatch(/^\$2/);
  });
});
