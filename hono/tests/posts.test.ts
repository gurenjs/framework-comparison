import { describe, expect, test } from 'bun:test'
import { createPost, createTestApp, del, json, register } from './helpers'

describe('posts', () => {
  test('unauthenticated post creation is rejected', async () => {
    const { app } = createTestApp()
    const res = await app.request('/api/posts', json('POST', { title: 'Hi', body: 'Body' }))
    expect(res.status).toBe(401)
  })

  test('post create/edit/delete happy path', async () => {
    const { app } = createTestApp()
    const { cookie } = await register(app)

    const post = await createPost(app, cookie, { title: 'My first post' })
    expect(post.title).toBe('My first post')

    const showRes = await app.request(`/api/posts/${post.id}`)
    expect(showRes.status).toBe(200)
    const shown = ((await showRes.json()) as { post: { author: { name: string } } }).post
    expect(shown.author.name).toBe('Alice')

    const updateRes = await app.request(
      `/api/posts/${post.id}`,
      json('PUT', { title: 'Updated title', body: 'Updated body' }, cookie),
    )
    expect(updateRes.status).toBe(200)
    expect(((await updateRes.json()) as { post: { title: string } }).post.title).toBe(
      'Updated title',
    )

    const deleteRes = await app.request(`/api/posts/${post.id}`, del(cookie))
    expect(deleteRes.status).toBe(204)

    const goneRes = await app.request(`/api/posts/${post.id}`)
    expect(goneRes.status).toBe(404)
  })

  test('a non-author cannot edit or delete someone else\'s post', async () => {
    const { app } = createTestApp()
    const { cookie: aliceCookie } = await register(app)
    const { cookie: bobCookie } = await register(app, { name: 'Bob', email: 'bob@example.com' })

    const post = await createPost(app, aliceCookie)

    const editRes = await app.request(
      `/api/posts/${post.id}`,
      json('PUT', { title: 'Hijacked', body: 'Hijacked' }, bobCookie),
    )
    expect(editRes.status).toBe(403)

    const deleteRes = await app.request(`/api/posts/${post.id}`, del(bobCookie))
    expect(deleteRes.status).toBe(403)

    const showRes = await app.request(`/api/posts/${post.id}`)
    expect(((await showRes.json()) as { post: { title: string } }).post.title).toBe('Hello world')
  })

  test('unknown post id returns 404', async () => {
    const { app } = createTestApp()
    expect((await app.request('/api/posts/9999')).status).toBe(404)
    expect((await app.request('/api/posts/not-a-number')).status).toBe(404)
  })

  test('list is paginated 10 per page, newest first', async () => {
    const { app } = createTestApp()
    const { cookie } = await register(app)
    for (let i = 1; i <= 11; i++) {
      await createPost(app, cookie, { title: `Post ${i}` })
    }

    const page1 = (await (await app.request('/api/posts')).json()) as {
      posts: { title: string }[]
      pagination: { total: number; totalPages: number }
    }
    expect(page1.posts).toHaveLength(10)
    expect(page1.posts[0]?.title).toBe('Post 11')
    expect(page1.pagination).toMatchObject({ total: 11, totalPages: 2 })

    const page2 = (await (await app.request('/api/posts?page=2')).json()) as {
      posts: { title: string }[]
    }
    expect(page2.posts).toHaveLength(1)
    expect(page2.posts[0]?.title).toBe('Post 1')
  })
})
