import User from '#models/user'
import Comment from '#models/comment'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

async function createPostWithAuthor() {
  const author = await User.create({
    fullName: 'Post Author',
    email: 'author@example.com',
    password: 'supersecret',
  })
  const post = await author.related('posts').create({ title: 'A post', body: 'Body' })
  return { author, post }
}

function createUser(email: string) {
  return User.create({ fullName: 'Commenter', email, password: 'supersecret' })
}

test.group('Comments', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a logged-in user can comment on a post', async ({ client, assert }) => {
    const { post } = await createPostWithAuthor()
    const commenter = await createUser('commenter@example.com')

    const response = await client
      .post(`/posts/${post.id}/comments`)
      .loginAs(commenter)
      .withCsrfToken()
      .form({ body: 'Nice post!' })

    response.assertRedirectsTo(`/posts/${post.id}`)
    const comment = await Comment.findByOrFail('postId', post.id)
    assert.equal(comment.body, 'Nice post!')
    assert.equal(comment.userId, commenter.id)
  })

  test('unauthenticated commenting is rejected', async ({ client, assert }) => {
    const { post } = await createPostWithAuthor()

    const response = await client
      .post(`/posts/${post.id}/comments`)
      .withCsrfToken()
      .form({ body: 'Anonymous comment' })

    response.assertRedirectsTo('/login')
    assert.lengthOf(await Comment.all(), 0)
  })

  test('a comment can be deleted by its author', async ({ client, assert }) => {
    const { post } = await createPostWithAuthor()
    const commenter = await createUser('commenter@example.com')
    const comment = await post
      .related('comments')
      .create({ body: 'Delete me', userId: commenter.id })

    const response = await client
      .delete(`/comments/${comment.id}`)
      .loginAs(commenter)
      .withCsrfToken()

    response.assertRedirectsTo(`/posts/${post.id}`)
    assert.isNull(await Comment.find(comment.id))
  })

  test('a comment can be deleted by the post’s author', async ({ client, assert }) => {
    const { author, post } = await createPostWithAuthor()
    const commenter = await createUser('commenter@example.com')
    const comment = await post
      .related('comments')
      .create({ body: 'Moderate me', userId: commenter.id })

    await client.delete(`/comments/${comment.id}`).loginAs(author).withCsrfToken()
    assert.isNull(await Comment.find(comment.id))
  })

  test('a third user cannot delete someone else’s comment', async ({ client, assert }) => {
    const { post } = await createPostWithAuthor()
    const commenter = await createUser('commenter@example.com')
    const intruder = await createUser('intruder@example.com')
    const comment = await post
      .related('comments')
      .create({ body: 'Protected', userId: commenter.id })

    /**
     * On mutating requests, a denied authorization redirects back
     * with an "Access denied" flash message
     */
    const response = await client
      .delete(`/comments/${comment.id}`)
      .loginAs(intruder)
      .withCsrfToken()
      .redirects(0)

    response.assertFlashMessage('error')
    assert.isNotNull(await Comment.find(comment.id))
  })

  test('comment validation errors are returned for invalid input', async ({ client, assert }) => {
    const { post } = await createPostWithAuthor()
    const commenter = await createUser('commenter@example.com')

    const response = await client
      .post(`/posts/${post.id}/comments`)
      .loginAs(commenter)
      .withCsrfToken()
      .redirects(0)
      .form({ body: '' })

    response.assertStatus(302)
    assert.property(response.flashMessage('inputErrorsBag'), 'body')
    assert.lengthOf(await Comment.all(), 0)
  })
})
