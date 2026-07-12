import { beforeEach, describe, expect, test } from 'vitest'

import { addComment, deleteComment } from '../src/server/comments'
import { createPost, getPost } from '../src/server/posts'
import { createUser, resetDb } from './helpers'

beforeEach(resetDb)

async function createPostFor(userId: number): Promise<number> {
  const result = await createPost(userId, { title: 'Post', body: 'Body' })
  if (result.status !== 'ok') throw new Error('setup failed')
  return result.post.id
}

describe('addComment', () => {
  test('adds a comment to a post (happy path)', async () => {
    const author = await createUser('Author')
    const commenter = await createUser('Commenter')
    const postId = await createPostFor(author.id)

    const result = await addComment(commenter.id, postId, 'Nice post!')
    expect(result.status).toBe('ok')

    const post = await getPost(postId)
    expect(post?.comments).toHaveLength(1)
    expect(post?.comments[0]).toMatchObject({
      body: 'Nice post!',
      author: { id: commenter.id, name: commenter.name },
    })
  })

  test('returns validation errors for an empty or over-length comment', async () => {
    const user = await createUser()
    const postId = await createPostFor(user.id)

    const empty = await addComment(user.id, postId, '')
    expect(empty.status).toBe('invalid')
    if (empty.status === 'invalid') {
      expect(empty.errors.body).toEqual(['Comment is required.'])
    }

    const tooLong = await addComment(user.id, postId, 'a'.repeat(1_001))
    expect(tooLong.status).toBe('invalid')
    if (tooLong.status === 'invalid') {
      expect(tooLong.errors.body).toEqual([
        'Comment must be at most 1,000 characters.',
      ])
    }
  })

  test('reports a missing post', async () => {
    const user = await createUser()
    expect((await addComment(user.id, 999, 'Hello')).status).toBe('not-found')
  })
})

describe('deleteComment', () => {
  test('the comment author can delete their comment', async () => {
    const author = await createUser('Author')
    const commenter = await createUser('Commenter')
    const postId = await createPostFor(author.id)
    const added = await addComment(commenter.id, postId, 'Mine')
    if (added.status !== 'ok') throw new Error('setup failed')

    expect(await deleteComment(commenter.id, added.comment.id)).toBe('ok')
    expect((await getPost(postId))?.comments).toHaveLength(0)
  })

  test("the post's author can delete someone else's comment", async () => {
    const author = await createUser('Author')
    const commenter = await createUser('Commenter')
    const postId = await createPostFor(author.id)
    const added = await addComment(commenter.id, postId, 'Delete me')
    if (added.status !== 'ok') throw new Error('setup failed')

    expect(await deleteComment(author.id, added.comment.id)).toBe('ok')
  })

  test('a third user cannot delete the comment', async () => {
    const author = await createUser('Author')
    const commenter = await createUser('Commenter')
    const bystander = await createUser('Bystander')
    const postId = await createPostFor(author.id)
    const added = await addComment(commenter.id, postId, 'Keep me')
    if (added.status !== 'ok') throw new Error('setup failed')

    expect(await deleteComment(bystander.id, added.comment.id)).toBe('forbidden')
    expect((await getPost(postId))?.comments).toHaveLength(1)
  })

  test('reports a missing comment', async () => {
    const user = await createUser()
    expect(await deleteComment(user.id, 999)).toBe('not-found')
  })
})
