import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createPost, createTestApp, register } from './helpers';

describe('comments', () => {
  let app: INestApplication<App>;
  let author: string;
  let commenter: string;
  let carol: string;
  let postId: number;

  beforeAll(async () => {
    app = await createTestApp();
    author = (await register(app)).cookie;
    commenter = (await register(app, { name: 'Bob', email: 'bob@example.com' }))
      .cookie;
    carol = (await register(app, { name: 'Carol', email: 'carol@example.com' }))
      .cookie;
    postId = (await createPost(app, author)).id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function addComment(cookie: string): Promise<number> {
    const res = await request(app.getHttpServer())
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', cookie)
      .send({ body: 'Nice post!' });
    expect(res.status).toBe(201);
    return (res.body as { comment: { id: number } }).comment.id;
  }

  it('logged-in user can comment; comment appears on the post', async () => {
    const commentId = await addComment(commenter);

    const shown = (
      await request(app.getHttpServer()).get(`/api/posts/${postId}`)
    ).body as {
      post: {
        comments: { id: number; body: string; author: { name: string } }[];
      };
    };
    const comment = shown.post.comments.find((c) => c.id === commentId);
    expect(comment).toMatchObject({
      body: 'Nice post!',
      author: { name: 'Bob' },
    });
  });

  it('unauthenticated commenting is rejected', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/posts/${postId}/comments`)
      .send({ body: 'Hi' });
    expect(res.status).toBe(401);
  });

  it('commenting on a missing post returns 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/posts/9999/comments')
      .set('Cookie', commenter)
      .send({ body: 'Hi' });
    expect(res.status).toBe(404);
  });

  it('comment author can delete their own comment', async () => {
    const commentId = await addComment(commenter);
    const res = await request(app.getHttpServer())
      .delete(`/api/comments/${commentId}`)
      .set('Cookie', commenter);
    expect(res.status).toBe(204);
  });

  it('post author can delete any comment on their post', async () => {
    const commentId = await addComment(commenter);
    const res = await request(app.getHttpServer())
      .delete(`/api/comments/${commentId}`)
      .set('Cookie', author);
    expect(res.status).toBe(204);
  });

  it('an unrelated user cannot delete the comment', async () => {
    const commentId = await addComment(commenter);
    const res = await request(app.getHttpServer())
      .delete(`/api/comments/${commentId}`)
      .set('Cookie', carol);
    expect(res.status).toBe(403);
  });
});
