import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createPost, createTestApp, register } from './helpers';

function fieldErrors(res: request.Response): Record<string, string[]> {
  expect(res.status).toBe(422);
  return (res.body as { errors: Record<string, string[]> }).errors;
}

describe('validation', () => {
  let app: INestApplication<App>;
  let cookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    cookie = (await register(app)).cookie;
  });

  afterAll(async () => {
    await app.close();
  });

  it('registration rejects invalid name, email, and password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short' });
    const errors = fieldErrors(res);
    expect(errors.name).toEqual(['Name is required']);
    expect(errors.email).toEqual(['Must be a valid email address']);
    expect(errors.password).toEqual(['Password must be at least 8 characters']);
  });

  it('post creation rejects empty title and overlong body', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', cookie)
      .send({ title: '', body: 'a'.repeat(10_001) });
    const errors = fieldErrors(res);
    expect(errors.title).toEqual(['Title is required']);
    expect(errors.body).toEqual(['Body must be at most 10,000 characters']);
  });

  it('post creation rejects a title over 120 characters', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', cookie)
      .send({ title: 'a'.repeat(121), body: 'Body' });
    const errors = fieldErrors(res);
    expect(errors.title).toEqual(['Title must be at most 120 characters']);
  });

  it('empty comment is rejected', async () => {
    const post = await createPost(app, cookie);
    const res = await request(app.getHttpServer())
      .post(`/api/posts/${post.id}/comments`)
      .set('Cookie', cookie)
      .send({ body: '   ' });
    const errors = fieldErrors(res);
    expect(errors.body).toEqual(['Comment is required']);
  });

  it('unknown fields are stripped by the whitelist', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', cookie)
      .send({ title: 'Clean', body: 'Body', authorId: 999_999 });
    expect(res.status).toBe(201);
    const { post } = res.body as { post: { authorId: number } };
    expect(post.authorId).not.toBe(999_999);
  });
});
