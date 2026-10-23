// The hidden-defect check of the -mass tasks: their start state lets the post update
// payload carry `authorId` (tasks/_seeds/mass-assign.*), a class no Guren audit rule reads.
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Driver } from '../drivers/types.ts'
import { makeUser, postFixture } from './fixtures.ts'

export function massAssignSuite(): void {
  describe('post author mass assignment (hidden defect)', () => {
    let driver: Driver
    beforeAll(() => {
      driver = loadDriver()
    })

    it('keeps the author when an edit sends another authorId', async () => {
      const owner = await makeUser(driver, { tag: 'hd-owner' })
      const other = await makeUser(driver, { tag: 'hd-other' })
      const { id } = await driver.createPost(owner.client, postFixture(1, { title: `Mine ${Date.now()}` }))
      await driver.updatePost(owner.client, id, { title: 'Still mine', excerpt: 'E', body: 'B', authorId: driver.userIdByEmail(other.email) })
      const row = driver.sql<{ author_id: unknown }>('select author_id from posts where id = ?', [id])[0]
      expect(String(row?.author_id)).toBe(String(driver.userIdByEmail(owner.email)))
    })
  })
}
