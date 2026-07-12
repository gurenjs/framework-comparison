import User from '#models/user'
import Post from '#models/post'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

function createUser(email = 'author@example.com') {
  return User.create({ fullName: 'Post Author', email, password: 'supersecret' })
}

test.group('Posts', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('index lists posts newest first, 10 per page', async ({ client, assert }) => {
    const user = await createUser()
    for (let index = 1; index <= 12; index++) {
      await user.related('posts').create({ title: `Post ${index}`, body: 'Body' })
    }

    const response = await client.get('/posts').withInertia()
    response.assertInertiaComponent('posts/index')

    const { posts } = response.inertiaProps as {
      posts: { data: { title: string }[]; metadata: { total: number; lastPage: number } }
    }
    assert.lengthOf(posts.data, 10)
    assert.equal(posts.metadata.total, 12)
    assert.equal(posts.metadata.lastPage, 2)
    assert.equal(posts.data[0]!.title, 'Post 12')
  })

  test('show returns 404 for an unknown post', async ({ client }) => {
    const response = await client.get('/posts/999')
    response.assertStatus(404)
  })

  test('unauthenticated post creation is rejected', async ({ client, assert }) => {
    const response = await client.post('/posts').withCsrfToken().form({
      title: 'Sneaky post',
      body: 'Should not be created',
    })

    response.assertRedirectsTo('/login')
    assert.isNull(await Post.findBy('title', 'Sneaky post'))
  })

  test('post create/edit/delete happy path', async ({ client, assert }) => {
    const user = await createUser()

    const created = await client.post('/posts').loginAs(user).withCsrfToken().form({
      title: 'Hello world',
      body: 'My first post',
    })
    const post = await Post.findByOrFail('title', 'Hello world')
    created.assertRedirectsTo(`/posts/${post.id}`)
    assert.equal(post.userId, user.id)

    await client.put(`/posts/${post.id}`).loginAs(user).withCsrfToken().form({
      title: 'Hello again',
      body: 'Now updated',
    })
    await post.refresh()
    assert.equal(post.title, 'Hello again')
    assert.equal(post.body, 'Now updated')

    const deleted = await client.delete(`/posts/${post.id}`).loginAs(user).withCsrfToken()
    deleted.assertRedirectsTo('/posts')
    assert.isNull(await Post.find(post.id))
  })

  test('a non-author cannot edit or delete someone else’s post', async ({ client, assert }) => {
    const author = await createUser()
    const intruder = await createUser('intruder@example.com')
    const post = await author.related('posts').create({ title: 'Mine', body: 'Hands off' })

    const editPage = await client.get(`/posts/${post.id}/edit`).loginAs(intruder)
    editPage.assertStatus(403)

    /**
     * On mutating requests, a denied authorization redirects back
     * with an "Access denied" flash message
     */
    const update = await client
      .put(`/posts/${post.id}`)
      .loginAs(intruder)
      .withCsrfToken()
      .redirects(0)
      .form({ title: 'Hijacked', body: 'Hijacked' })
    update.assertFlashMessage('error')

    const destroy = await client
      .delete(`/posts/${post.id}`)
      .loginAs(intruder)
      .withCsrfToken()
      .redirects(0)
    destroy.assertFlashMessage('error')

    await post.refresh()
    assert.equal(post.title, 'Mine')
  })

  test('post validation errors are returned for invalid input', async ({ client, assert }) => {
    const user = await createUser()

    const response = await client.post('/posts').loginAs(user).withCsrfToken().redirects(0).form({
      title: '',
      body: '',
    })

    response.assertStatus(302)
    assert.properties(response.flashMessage('inputErrorsBag'), ['title', 'body'])
    assert.lengthOf(await Post.all(), 0)
  })
})
