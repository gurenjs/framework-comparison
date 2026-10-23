// Port of agents-on-guren tasks/raw-body-no-validation/hidden/profile-update-validation.test.ts
//
// The hidden test reads the users row directly (User.find). Black-box, the
// account state is observed through:
//   - the profile page (name + email the app shows the signed-in user),
//   - signing in again on a fresh client (proves email + password hash),
//   - a post authored before the update (its page must still show the
//     author, which only works while the account keeps its id).
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Driver } from '../drivers/types.ts'
import { makeUser, postFixture, uniqueEmail } from '../lib/fixtures.ts'

describe('PUT /profile input validation', () => {
  let driver: Driver

  beforeAll(() => {
    driver = loadDriver()
  })

  /** The hidden test sends `password: ''` ("keep current password"); only where the form has that field. */
  const noPassword = (): Record<string, unknown> => (driver.capabilities.profilePassword ? { password: '' } : {})

  // Hidden test: 422 + errors.<field>. Frameworks report validation failure
  // differently (Guren 422 JSON; Void 200 page JSON with `errors`), so the
  // driver decides: `ok: false` with a non-empty `errors` means "rejected by
  // validation" (the Guren driver only reports that for a real 422).
  function expectRejected(res: { ok: boolean; errors: Record<string, unknown>; status: number; bodyText: string }, field: string) {
    expect(res.ok, `status ${res.status}: ${res.bodyText.slice(0, 200)}`).toBe(false)
    expect(res.errors).toHaveProperty(field)
  }

  function expectAccepted(res: { ok: boolean; errors: Record<string, unknown>; status: number; bodyText: string }) {
    expect(res.ok, `status ${res.status}: ${res.bodyText.slice(0, 200)}`).toBe(true)
    expect(res.errors).toEqual({})
  }

  it('rejects a badly formatted email as a validation error and leaves the account unchanged', async () => {
    const user = await makeUser(driver, { name: 'Original Name' })

    const res = await driver.updateProfile(user.client, { name: 'Original Name', email: 'not-an-email', ...noPassword() })
    expectRejected(res, 'email')

    expect(await driver.getProfile(user.client)).toEqual({ name: 'Original Name', email: user.email })
    expect((await driver.login(driver.newClient(), { email: user.email, password: user.password })).ok).toBe(true)
  })

  it('rejects an empty name as a validation error and leaves the account unchanged', async () => {
    const user = await makeUser(driver, { name: 'Original Name' })

    const res = await driver.updateProfile(user.client, { name: '', email: user.email, ...noPassword() })
    expectRejected(res, 'name')

    expect(await driver.getProfile(user.client)).toEqual({ name: 'Original Name', email: user.email })
  })

  it('still saves a valid update', async () => {
    const user = await makeUser(driver)
    const email = uniqueEmail('renamed')

    const res = await driver.updateProfile(user.client, { name: 'Renamed User', email, ...noPassword() })
    expectAccepted(res)

    expect(await driver.getProfile(user.client)).toEqual({ name: 'Renamed User', email })
    // Hidden test: passwordHash unchanged. Black-box: the original password
    // still signs in (with the new email).
    expect((await driver.login(driver.newClient(), { email, password: user.password })).ok).toBe(true)
  })

  it('normalizes a valid update the way registration does (name trimmed, email lowercased)', async () => {
    // Not in the hidden test; required by the statement ("surrounding
    // whitespace is trimmed", "stored in lowercase").
    const user = await makeUser(driver)
    const email = uniqueEmail('mixedcase')

    const res = await driver.updateProfile(user.client, { name: '  Trimmed Name  ', email: `  ${email.toUpperCase()} `, ...noPassword() })
    expectAccepted(res)

    expect(await driver.getProfile(user.client)).toEqual({ name: 'Trimmed Name', email })
  })

  it('ignores fields that are not part of the profile form', async () => {
    const user = await makeUser(driver)
    const email = uniqueEmail('renamed-extra')

    const res = await driver.updateProfile(user.client, {
      name: 'Renamed User',
      email,
      ...noPassword(),
      passwordHash: 'not-a-real-hash',
      role: 'admin',
    })
    expectAccepted(res)

    expect(await driver.getProfile(user.client)).toEqual({ name: 'Renamed User', email })
    // Hidden test: passwordHash unchanged. Black-box: the original password
    // still signs in, which it cannot if the hash was overwritten.
    expect((await driver.login(driver.newClient(), { email, password: user.password })).ok).toBe(true)
  })

  it('never lets the request change the account id', async () => {
    const user = await makeUser(driver)
    const { id: postId } = await driver.createPost(user.client, postFixture('before-id-change'))
    const email = uniqueEmail('renamed-id')

    const res = await driver.updateProfile(user.client, { id: 999_999, name: 'Renamed User', email, ...noPassword() })
    expectAccepted(res)

    // Hidden test: User.find(user.id) still exists with the new email and
    // User.find(999999) is null. Black-box: the session (which holds the
    // account id) still resolves to the account, and the post authored under
    // the original id still resolves its author.
    expect(await driver.getProfile(user.client)).toEqual({ name: 'Renamed User', email })
    const post = await driver.getPost(driver.newClient(), postId)
    expect(post?.author?.name).toBe('Renamed User')
  })
})
