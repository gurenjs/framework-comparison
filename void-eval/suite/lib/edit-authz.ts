// The control check of the -eauthz tasks: their start state drops the author check
// from the edit page's GET (tasks/_seeds/edit-authz.*), a class no Guren audit rule reads.
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Driver } from '../drivers/types.ts'
import { makeUser, postFixture } from './fixtures.ts'
import { isForbidden } from './robust.ts'

export function editAuthzSuite(): void {
  describe('post edit page authorization (hidden defect)', () => {
    let driver: Driver
    beforeAll(() => {
      driver = loadDriver()
    })

    it("refuses another user the edit page of a post", async () => {
      const owner = await makeUser(driver, { tag: 'hd-owner' })
      const other = await makeUser(driver, { tag: 'hd-other' })
      const { id } = await driver.createPost(owner.client, postFixture(1, { title: `Private ${Date.now()}` }))
      const page = await driver.page(other.client, `/posts/${id}/edit`)
      expect(isForbidden(page), `edit page for another user: ${page.status}`).toBe(true)
    })
  })
}
