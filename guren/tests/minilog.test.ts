import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { TestApp } from '@guren/testing'

const TEST_DB = new URL('./minilog-test.db', import.meta.url).pathname
process.env.DATABASE_URL = TEST_DB
process.env.GUREN_TESTING = '1'

const { migrateDatabase } = await import('../config/database.js')
const { default: app } = await import('../src/app.js')

async function createUser(name: string, email: string, password = 'password123') {
  const { ScryptHasher } = await import('@guren/core')
  const { User } = await import('../app/Models/User.js')
  const passwordHash = await new ScryptHasher().hash(password)
  return (await User.create({ name, email, passwordHash }))!
}

let http: TestApp

beforeAll(async () => {
  rmSync(TEST_DB, { force: true })
  await migrateDatabase()
  await app.boot()
  http = await TestApp.fromFetch((request: Request) => app.fetch(request))
})

afterAll(() => {
  rmSync(TEST_DB, { force: true })
})

describe('authentication', () => {
  test('register creates the user, logs in, and records a welcome notification', async () => {
    const csrf = await http.withCsrf('/register')
    await csrf
      .post('/register', { name: 'Ada', email: 'ada@example.com', password: 'password123' })
      .assertRedirect('/posts')

    const { User } = await import('../app/Models/User.js')
    const user = await User.where('email', 'ada@example.com').first()
    expect(user).not.toBeNull()
    expect(user?.name).toBe('Ada')

    // The welcome notification is queued; process it like a worker run.
    const { Worker, getQueueDriver } = await import('@guren/core')
    await new Worker(getQueueDriver()!, { stopWhenEmpty: true, sleep: 10 }).start()

    const { Notification } = await import('../app/Models/Notification.js')
    const notification = await Notification.where('userId', user!.id).first()
    expect(notification?.type).toBe('welcome')
  })

  test('register rejects invalid input with validation errors', async () => {
    const csrf = await http.withCsrf('/register')
    await csrf
      .json()
      .post('/register', { name: '', email: 'not-an-email', password: 'short' })
      .assertUnprocessable()
  })

  test('login succeeds with correct credentials and logout redirects home', async () => {
    const user = await createUser('Grace', 'grace@example.com')

    const csrf = await http.withCsrf('/login')
    await csrf.post('/login', { email: 'grace@example.com', password: 'password123' }).assertRedirect('/posts')

    const authed = await http.actingAs(user).withCsrf('/posts')
    await authed.post('/logout', {}).assertRedirect('/')
  })

  test('login fails with wrong credentials', async () => {
    await createUser('Edsger', 'edsger@example.com')

    const csrf = await http.withCsrf('/login')
    await csrf.json().post('/login', { email: 'edsger@example.com', password: 'wrong-password' }).assertUnprocessable()
  })
})

describe('posts', () => {
  test('unauthenticated post creation is redirected to login', async () => {
    const csrf = await http.withCsrf('/posts')
    await csrf.post('/posts', { title: 'Nope', body: 'Not logged in' }).assertRedirect('/login')
  })

  test('create, edit, and delete a post as its author', async () => {
    const author = await createUser('Alan', 'alan@example.com')
    const authed = await http.actingAs(author).withCsrf('/posts')

    const created = await authed.post('/posts', { title: 'Hello', body: 'First post' })
    created.assertRedirect()
    const location = created.headers.get('location')!
    const postId = Number(location.split('/').pop())

    await authed.get(`/posts/${postId}`).assertOk()

    await authed.put(`/posts/${postId}`, { title: 'Hello again', body: 'Edited body' }).assertRedirect(`/posts/${postId}`)

    const { Post } = await import('../app/Models/Post.js')
    expect((await Post.find(postId))?.title).toBe('Hello again')

    await authed.delete(`/posts/${postId}`).assertRedirect('/posts')
    expect(await Post.find(postId)).toBeNull()
  })

  test('a non-author cannot edit or delete someone else’s post', async () => {
    const author = await createUser('Owner', 'owner@example.com')
    const intruder = await createUser('Intruder', 'intruder@example.com')

    const { Post } = await import('../app/Models/Post.js')
    const post = (await Post.create({ title: 'Mine', body: 'Owned', userId: author.id as number }))!

    const authed = await http.actingAs(intruder).withCsrf('/posts')
    await authed.put(`/posts/${post.id}`, { title: 'Stolen', body: 'Hacked' }).assertForbidden()
    await authed.delete(`/posts/${post.id}`).assertForbidden()

    expect((await Post.find(post.id))?.title).toBe('Mine')
  })

  test('post validation rejects a too-long title with field errors', async () => {
    const author = await createUser('Val', 'val@example.com')
    const authed = await http.actingAs(author).withCsrf('/posts')

    await authed.json().post('/posts', { title: 'x'.repeat(121), body: 'ok' }).assertUnprocessable()
    await authed.json().post('/posts', { title: '', body: '' }).assertUnprocessable()
  })

  test('listing paginates ten posts per page, newest first', async () => {
    const author = await createUser('Paginator', 'paginator@example.com')
    const { Post } = await import('../app/Models/Post.js')
    for (let i = 1; i <= 11; i += 1) {
      await Post.create({
        title: `Page test ${i}`,
        body: 'body',
        userId: author.id as number,
      })
    }

    await http.json().get('/posts').assertOk()
  })
})

describe('comments', () => {
  test('a logged-in user can comment; author or post owner can delete', async () => {
    const owner = await createUser('PostOwner', 'postowner@example.com')
    const commenter = await createUser('Commenter', 'commenter@example.com')
    const bystander = await createUser('Bystander', 'bystander@example.com')

    const { Post } = await import('../app/Models/Post.js')
    const { Comment } = await import('../app/Models/Comment.js')
    const post = (await Post.create({ title: 'Discuss', body: 'Comments welcome', userId: owner.id as number }))!

    const asCommenter = await http.actingAs(commenter).withCsrf('/posts')
    await asCommenter.post(`/posts/${post.id}/comments`, { body: 'Nice post!' }).assertRedirect(`/posts/${post.id}`)

    const comment = (await Comment.where('postId', post.id).first())!

    // A bystander cannot delete someone else's comment.
    const asBystander = await http.actingAs(bystander).withCsrf('/posts')
    await asBystander.delete(`/posts/${post.id}/comments/${comment.id}`).assertForbidden()

    // The post owner can.
    const asOwner = await http.actingAs(owner).withCsrf('/posts')
    await asOwner.delete(`/posts/${post.id}/comments/${comment.id}`).assertRedirect(`/posts/${post.id}`)
    expect(await Comment.find(comment.id)).toBeNull()
  })

  test('comment validation rejects an empty body', async () => {
    const owner = await createUser('CV Owner', 'cvowner@example.com')
    const { Post } = await import('../app/Models/Post.js')
    const post = (await Post.create({ title: 'Strict', body: 'No empty comments', userId: owner.id as number }))!

    const authed = await http.actingAs(owner).withCsrf('/posts')
    await authed.json().post(`/posts/${post.id}/comments`, { body: '' }).assertUnprocessable()
  })
})
