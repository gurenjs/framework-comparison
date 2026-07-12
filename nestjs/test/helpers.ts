import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

/**
 * Boots the real application (module tree + setupApp pipeline) against an
 * in-memory SQLite database. Passport registers its strategies and session
 * (de)serializers on a process-global instance, so each Jest worker — i.e.
 * each spec file — must create at most one app.
 */
export async function createTestApp(): Promise<INestApplication<App>> {
  process.env.DATABASE_PATH = ':memory:';
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = setupApp(moduleRef.createNestApplication());
  await app.init();
  return app as INestApplication<App>;
}

/** Extracts the session cookie pair ("name=value") from the response. */
export function sessionCookie(res: request.Response): string {
  const pair = res.get('Set-Cookie')?.[0]?.split(';')[0];
  if (!pair) throw new Error('Expected a Set-Cookie header');
  return pair;
}

export async function register(
  app: INestApplication<App>,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<{ cookie: string; userId: number }> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`Registration failed with status ${res.status}`);
  }
  const { user } = res.body as { user: { id: number } };
  return { cookie: sessionCookie(res), userId: user.id };
}

export async function createPost(
  app: INestApplication<App>,
  cookie: string,
  overrides: Partial<{ title: string; body: string }> = {},
): Promise<{ id: number; title: string; body: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/posts')
    .set('Cookie', cookie)
    .send({ title: 'Hello world', body: 'First post body', ...overrides });
  if (res.status !== 201) {
    throw new Error(`Post creation failed with status ${res.status}`);
  }
  return (res.body as { post: { id: number; title: string; body: string } })
    .post;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
