import User from '#models/user'
import Notification from '#models/notification'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * The welcome notification is recorded outside the request/response
 * critical path, so we poll for it instead of asserting right away
 */
async function pollFor<T>(callback: () => Promise<T | null>, timeout = 2000): Promise<T> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const result = await callback()
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('Timed out while polling')
}

test.group('Auth', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('register → login → logout flow', async ({ client, assert }) => {
    const signup = await client.post('/signup').withCsrfToken().form({
      fullName: 'Alice Doe',
      email: 'alice@example.com',
      password: 'supersecret',
    })
    signup.assertRedirectsTo('/posts')

    const user = await User.findByOrFail('email', 'alice@example.com')
    assert.equal(user.fullName, 'Alice Doe')
    assert.notEqual(user.password, 'supersecret')

    const login = await client.post('/login').withCsrfToken().form({
      email: 'alice@example.com',
      password: 'supersecret',
    })
    login.assertRedirectsTo('/posts')

    const logout = await client.post('/logout').withCsrfToken().loginAs(user)
    logout.assertRedirectsTo('/login')
  })

  test('login with invalid credentials is rejected', async ({ client }) => {
    await User.create({
      fullName: 'Alice Doe',
      email: 'alice@example.com',
      password: 'supersecret',
    })

    const login = await client.post('/login').withCsrfToken().redirects(0).form({
      email: 'alice@example.com',
      password: 'wrong-password',
    })
    login.assertFlashMessage('error', 'Invalid email or password')
  })

  test('registration records a welcome notification', async ({ client, assert }) => {
    await client.post('/signup').withCsrfToken().form({
      fullName: 'Bob Doe',
      email: 'bob@example.com',
      password: 'supersecret',
    })

    const user = await User.findByOrFail('email', 'bob@example.com')
    const notification = await pollFor(() => Notification.findBy('userId', user.id))

    assert.equal(notification.type, 'welcome')
    assert.include(notification.body, 'Bob Doe')
  })

  test('signup validation errors are returned for invalid input', async ({ client, assert }) => {
    const response = await client.post('/signup').withCsrfToken().redirects(0).form({
      fullName: '',
      email: 'not-an-email',
      password: 'short',
    })

    response.assertStatus(302)
    assert.properties(response.flashMessage('inputErrorsBag'), ['fullName', 'email', 'password'])
    assert.isNull(await User.findBy('email', 'not-an-email'))
  })

  test('signup rejects duplicate emails', async ({ client, assert }) => {
    await User.create({
      fullName: 'Alice Doe',
      email: 'alice@example.com',
      password: 'supersecret',
    })

    const response = await client.post('/signup').withCsrfToken().redirects(0).form({
      fullName: 'Alice Clone',
      email: 'alice@example.com',
      password: 'supersecret',
    })
    response.assertStatus(302)
    assert.property(response.flashMessage('inputErrorsBag'), 'email')
  })
})
