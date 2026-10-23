// The hidden-defect check of the -dauthz tasks: their start state drops the author
// check from the post delete action (tasks/_seeds/destroy-authz.*).
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Driver } from '../drivers/types.ts'
import { makeUser, postFixture } from './fixtures.ts'

export function destroyAuthzSuite(): void {
  describe('post delete authorization (hidden defect)', () => {
    let driver: Driver
    beforeAll(() => {
      driver = loadDriver()
    })

    it("refuses another user's delete of a post and keeps it", async () => {
      const owner = await makeUser(driver, { tag: 'hd-owner' })
      const other = await makeUser(driver, { tag: 'hd-other' })
      const { id } = await driver.createPost(owner.client, postFixture(1, { title: `Kept ${Date.now()}` }))
      const res = await driver.deletePost(other.client, id)
      expect(res.ok, `delete by another user: ${res.status}`).toBe(false)
      expect(await driver.getPostStatus(driver.newClient(), id)).toBe(200)
    })
  })
}
