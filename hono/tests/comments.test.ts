import { describe, expect, test } from 'bun:test'
import { createPost, createTestApp, del, json, register } from './helpers'

async function setup() {
  const { app } = createTestApp()
  const { cookie: authorCookie } = await register(app)
  const { cookie: commenterCookie } = await register(app, {
    name: 'Bob',
    email: 'bob@example.com',
  })
  const post = await createPost(app, authorCookie)
  return { app, authorCookie, commenterCookie, post }
}

async function addComment(
  app: Awaited<ReturnType<typeof setup>>['app'],
  postId: number,
  cookie: string,
): Promise<number> {
  const res = await app.request(
    `/api/posts/${postId}/comments`,
    json('POST', { body: 'Nice post!' }, cookie),
  )
  expect(res.status).toBe(201)
  return ((await res.json()) as { comment: { id: number } }).comment.id
}

describe('comments', () => {
  test('logged-in user can comment; comment appears on the post', async () => {
    const { app, commenterCookie, post } = await setup()
    await addComment(app, post.id, commenterCookie)

    const shown = (await (await app.request(`/api/posts/${post.id}`)).json()) as {
      post: { comments: { body: string; author: { name: string } }[] }
    }
    expect(shown.post.comments).toHaveLength(1)
    expect(shown.post.comments[0]).toMatchObject({
      body: 'Nice post!',
      author: { name: 'Bob' },
    })
  })

  test('unauthenticated commenting is rejected', async () => {
    const { app, post } = await setup()
    const res = await app.request(`/api/posts/${post.id}/comments`, json('POST', { body: 'Hi' }))
    expect(res.status).toBe(401)
  })

  test('comment author can delete their own comment', async () => {
    const { app, commenterCookie, post } = await setup()
    const commentId = await addComment(app, post.id, commenterCookie)

    const res = await app.request(`/api/comments/${commentId}`, del(commenterCookie))
    expect(res.status).toBe(204)
  })

  test('post author can delete any comment on their post', async () => {
    const { app, authorCookie, commenterCookie, post } = await setup()
    const commentId = await addComment(app, post.id, commenterCookie)

    const res = await app.request(`/api/comments/${commentId}`, del(authorCookie))
    expect(res.status).toBe(204)
  })

  test('an unrelated user cannot delete the comment', async () => {
    const { app, commenterCookie, post } = await setup()
    const commentId = await addComment(app, post.id, commenterCookie)
    const { cookie: carolCookie } = await register(app, {
      name: 'Carol',
      email: 'carol@example.com',
    })

    const res = await app.request(`/api/comments/${commentId}`, del(carolCookie))
    expect(res.status).toBe(403)
  })
})
