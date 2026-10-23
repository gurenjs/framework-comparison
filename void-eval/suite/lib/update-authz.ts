// The hidden-defect check of the -authz tasks: their start state drops the
// author check from the post update action (tasks/_seeds/update-authz.*), a
// defect the statement never names. Passing means the agent restored it.
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Driver } from '../drivers/types.ts'
import { makeUser, postFixture } from './fixtures.ts'
import { isForbidden } from './robust.ts'

export function updateAuthzSuite(): void {
  describe('post update authorization (hidden defect)', () => {
    let driver: Driver
    beforeAll(() => {
      driver = loadDriver()
    })

    it("refuses another user's edit of a post and changes nothing", async () => {
      const owner = await makeUser(driver, { tag: 'hd-owner' })
      const other = await makeUser(driver, { tag: 'hd-other' })
      const title = `Owned ${Date.now()}`
      const { id } = await driver.createPost(owner.client, postFixture(1, { title }))
      const res = await driver.updatePost(other.client, id, { title: 'Taken over', excerpt: 'E', body: 'B' })
      expect(isForbidden(res), `update by another user: ${res.status}`).toBe(true)
      const row = driver.sql<{ title: string }>('select title from posts where id = ?', [id])[0]
      expect(row?.title).toBe(title)
    })
  })
}
