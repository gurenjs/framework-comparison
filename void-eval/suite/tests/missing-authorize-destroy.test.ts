// Port of agents-on-guren tasks/missing-authorize-destroy/hidden/destroy-authorization.test.ts
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Driver } from '../drivers/types.ts'
import { makeUser, postFixture } from '../lib/fixtures.ts'

describe('DELETE /posts/:id authorization', () => {
  let driver: Driver

  beforeAll(() => {
    driver = loadDriver()
  })

  it('refuses a signed-in non-author with 403 and keeps the post', async () => {
    const author = await makeUser(driver, { tag: 'author' })
    const other = await makeUser(driver, { tag: 'other' })
    const { id } = await driver.createPost(author.client, postFixture('owned-by-author'))

    const res = await driver.deletePost(other.client, id)
    expect(res.status).toBe(403)
    expect(await driver.getPostStatus(driver.newClient(), id)).toBe(200)
  })

  it('refuses a guest and keeps the post', async () => {
    const author = await makeUser(driver, { tag: 'author' })
    const { id } = await driver.createPost(author.client, postFixture('guest-target'))

    const res = await driver.deletePost(driver.newClient(), id)
    expect([302, 401, 403]).toContain(res.status)
    expect(await driver.getPostStatus(driver.newClient(), id)).toBe(200)
  })

  it('still lets the author delete their own post', async () => {
    const author = await makeUser(driver, { tag: 'author' })
    const { id } = await driver.createPost(author.client, postFixture('self-delete'))
    expect(await driver.getPostStatus(driver.newClient(), id)).toBe(200)

    const res = await driver.deletePost(author.client, id)
    // Hidden test: status 302/303. That success contract is framework-specific
    // and enforced by the driver's `ok` (Guren: 302/303).
    expect(res.ok).toBe(true)
    expect(await driver.getPostStatus(driver.newClient(), id)).toBe(404)
  })
})
