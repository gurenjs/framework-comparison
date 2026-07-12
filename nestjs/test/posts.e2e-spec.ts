import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createPost, createTestApp, register } from './helpers';

interface ListBody {
  posts: { id: number; title: string }[];
  pagination: { page: number; total: number; totalPages: number };
}

describe('posts', () => {
  let app: INestApplication<App>;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    app = await createTestApp();
    alice = (await register(app)).cookie;
    bob = (await register(app, { name: 'Bob', email: 'bob@example.com' }))
      .cookie;
  });

  afterAll(async () => {
    await app.close();
  });

  it('unauthenticated post creation is rejected', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/posts')
      .send({ title: 'Hi', body: 'Body' });
    expect(res.status).toBe(401);
  });

  it('post create/edit/delete happy path', async () => {
    const server = app.getHttpServer();
    const post = await createPost(app, alice, { title: 'My first post' });
    expect(post.title).toBe('My first post');

    const showRes = await request(server).get(`/api/posts/${post.id}`);
    expect(showRes.status).toBe(200);
    const shown = (showRes.body as { post: { author: { name: string } } }).post;
    expect(shown.author.name).toBe('Alice');

    const updateRes = await request(server)
      .put(`/api/posts/${post.id}`)
      .set('Cookie', alice)
      .send({ title: 'Updated title', body: 'Updated body' });
    expect(updateRes.status).toBe(200);
    expect((updateRes.body as { post: { title: string } }).post.title).toBe(
      'Updated title',
    );

    const deleteRes = await request(server)
      .delete(`/api/posts/${post.id}`)
      .set('Cookie', alice);
    expect(deleteRes.status).toBe(204);

    const goneRes = await request(server).get(`/api/posts/${post.id}`);
    expect(goneRes.status).toBe(404);
  });

  it("a non-author cannot edit or delete someone else's post", async () => {
    const server = app.getHttpServer();
    const post = await createPost(app, alice);

    const editRes = await request(server)
      .put(`/api/posts/${post.id}`)
      .set('Cookie', bob)
      .send({ title: 'Hijacked', body: 'Hijacked' });
    expect(editRes.status).toBe(403);

    const deleteRes = await request(server)
      .delete(`/api/posts/${post.id}`)
      .set('Cookie', bob);
    expect(deleteRes.status).toBe(403);

    const showRes = await request(server).get(`/api/posts/${post.id}`);
    expect((showRes.body as { post: { title: string } }).post.title).toBe(
      'Hello world',
    );
  });

  it('unknown post id returns 404', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get('/api/posts/9999')).status).toBe(404);
    expect((await request(server).get('/api/posts/not-a-number')).status).toBe(
      404,
    );
  });

  it('list is paginated 10 per page, newest first', async () => {
    const server = app.getHttpServer();
    const before = (await request(server).get('/api/posts')).body as ListBody;

    for (let i = 1; i <= 11; i++) {
      await createPost(app, alice, { title: `Page test ${i}` });
    }
    const total = before.pagination.total + 11;

    const page1 = (await request(server).get('/api/posts')).body as ListBody;
    expect(page1.posts).toHaveLength(10);
    expect(page1.posts[0].title).toBe('Page test 11');
    expect(page1.pagination).toMatchObject({
      page: 1,
      total,
      totalPages: Math.ceil(total / 10),
    });

    const page2 = (await request(server).get('/api/posts?page=2'))
      .body as ListBody;
    expect(page2.posts[0].title).toBe('Page test 1');
  });
});
