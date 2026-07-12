import { describe, expect, test } from 'bun:test'
import { createPost, createTestApp, json, register } from './helpers'

async function fieldErrors(res: Response): Promise<Record<string, string[]>> {
  expect(res.status).toBe(422)
  return ((await res.json()) as { errors: Record<string, string[]> }).errors
}

describe('validation', () => {
  test('registration rejects invalid name, email, and password', async () => {
    const { app } = createTestApp()
    const res = await app.request(
      '/api/auth/register',
      json('POST', { name: '', email: 'not-an-email', password: 'short' }),
    )
    const errors = await fieldErrors(res)
    expect(errors.name).toEqual(['Name is required'])
    expect(errors.email).toEqual(['Must be a valid email address'])
    expect(errors.password).toEqual(['Password must be at least 8 characters'])
  })

  test('post creation rejects empty title and overlong body', async () => {
    const { app } = createTestApp()
    const { cookie } = await register(app)

    const res = await app.request(
      '/api/posts',
      json('POST', { title: '', body: 'a'.repeat(10_001) }, cookie),
    )
    const errors = await fieldErrors(res)
    expect(errors.title).toEqual(['Title is required'])
    expect(errors.body).toEqual(['Body must be at most 10,000 characters'])
  })

  test('post creation rejects a title over 120 characters', async () => {
    const { app } = createTestApp()
    const { cookie } = await register(app)

    const res = await app.request(
      '/api/posts',
      json('POST', { title: 'a'.repeat(121), body: 'Body' }, cookie),
    )
    const errors = await fieldErrors(res)
    expect(errors.title).toEqual(['Title must be at most 120 characters'])
  })

  test('empty comment is rejected', async () => {
    const { app } = createTestApp()
    const { cookie } = await register(app)
    const post = await createPost(app, cookie)

    const res = await app.request(
      `/api/posts/${post.id}/comments`,
      json('POST', { body: '   ' }, cookie),
    )
    const errors = await fieldErrors(res)
    expect(errors.body).toEqual(['Comment is required'])
  })
})
