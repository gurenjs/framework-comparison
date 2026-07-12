import { beforeEach, describe, expect, test } from 'vitest'

import {
  POSTS_PER_PAGE,
  createPost,
  deletePost,
  getPost,
  listPosts,
  updatePost,
} from '../src/server/posts'
import { createUser, resetDb } from './helpers'

beforeEach(resetDb)

const input = { title: 'Hello', body: 'World' }

describe('createPost', () => {
  test('creates a post for the author (happy path)', async () => {
    const user = await createUser()
    const result = await createPost(user.id, input)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return

    const post = await getPost(result.post.id)
    expect(post).toMatchObject({
      title: 'Hello',
      body: 'World',
      author: { id: user.id, name: user.name },
      comments: [],
    })
  })

  test('returns per-field validation errors', async () => {
    const user = await createUser()
    const result = await createPost(user.id, { title: '', body: '' })
    expect(result.status).toBe('invalid')
    if (result.status !== 'invalid') return
    expect(result.errors.title).toEqual(['Title is required.'])
    expect(result.errors.body).toEqual(['Body is required.'])
  })

  test('rejects over-length title and body', async () => {
    const user = await createUser()
    const result = await createPost(user.id, {
      title: 'a'.repeat(121),
      body: 'b'.repeat(10_001),
    })
    expect(result.status).toBe('invalid')
    if (result.status !== 'invalid') return
    expect(result.errors.title).toEqual(['Title must be at most 120 characters.'])
    expect(result.errors.body).toEqual(['Body must be at most 10,000 characters.'])
  })
})

describe('updatePost', () => {
  test('lets the author edit (happy path)', async () => {
    const user = await createUser()
    const created = await createPost(user.id, input)
    if (created.status !== 'ok') throw new Error('setup failed')

    const result = await updatePost(user.id, created.post.id, {
      title: 'Updated',
      body: 'Updated body',
    })
    expect(result.status).toBe('ok')
    expect(await getPost(created.post.id)).toMatchObject({ title: 'Updated' })
  })

  test('forbids a non-author', async () => {
    const author = await createUser('Author')
    const other = await createUser('Other')
    const created = await createPost(author.id, input)
    if (created.status !== 'ok') throw new Error('setup failed')

    const result = await updatePost(other.id, created.post.id, {
      title: 'Hijacked',
      body: 'Nope',
    })
    expect(result.status).toBe('forbidden')
    expect(await getPost(created.post.id)).toMatchObject({ title: 'Hello' })
  })

  test('reports a missing post', async () => {
    const user = await createUser()
    expect((await updatePost(user.id, 999, input)).status).toBe('not-found')
  })

  test('returns validation errors and keeps the post unchanged', async () => {
    const user = await createUser()
    const created = await createPost(user.id, input)
    if (created.status !== 'ok') throw new Error('setup failed')

    const result = await updatePost(user.id, created.post.id, {
      title: '',
      body: 'ok',
    })
    expect(result.status).toBe('invalid')
    expect(await getPost(created.post.id)).toMatchObject({ title: 'Hello' })
  })
})

describe('deletePost', () => {
  test('lets the author delete (happy path)', async () => {
    const user = await createUser()
    const created = await createPost(user.id, input)
    if (created.status !== 'ok') throw new Error('setup failed')

    expect(await deletePost(user.id, created.post.id)).toBe('ok')
    expect(await getPost(created.post.id)).toBeNull()
  })

  test('forbids a non-author', async () => {
    const author = await createUser('Author')
    const other = await createUser('Other')
    const created = await createPost(author.id, input)
    if (created.status !== 'ok') throw new Error('setup failed')

    expect(await deletePost(other.id, created.post.id)).toBe('forbidden')
    expect(await getPost(created.post.id)).not.toBeNull()
  })

  test('reports a missing post', async () => {
    const user = await createUser()
    expect(await deletePost(user.id, 999)).toBe('not-found')
  })
})

describe('listPosts pagination', () => {
  test('returns 10 posts per page, newest first', async () => {
    const user = await createUser()
    for (let i = 1; i <= 12; i++) {
      await createPost(user.id, { title: `Post ${i}`, body: 'Body' })
    }

    const page1 = await listPosts(1)
    expect(page1.items).toHaveLength(POSTS_PER_PAGE)
    expect(page1.items[0]).toMatchObject({
      title: 'Post 12',
      authorName: user.name,
    })
    expect(page1.total).toBe(12)
    expect(page1.pageCount).toBe(2)

    const page2 = await listPosts(2)
    expect(page2.items).toHaveLength(2)
    expect(page2.items.map((p) => p.title)).toEqual(['Post 2', 'Post 1'])
  })

  test('clamps invalid page numbers to 1', async () => {
    const user = await createUser()
    await createPost(user.id, input)
    expect((await listPosts(0)).page).toBe(1)
    expect((await listPosts(Number.NaN)).page).toBe(1)
  })
})

describe('getPost', () => {
  test('returns null for an unknown id (rendered as 404)', async () => {
    expect(await getPost(999)).toBeNull()
  })
})
