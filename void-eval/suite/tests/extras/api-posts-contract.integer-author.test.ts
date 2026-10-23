// Framework-specific extra (NOT part of the shared grade): the hidden test's
// "rejects invalid query parameters with 422" in full: strict 422 for every
// case, including ?author=abc|0, which only make sense where user ids are
// positive integers. Skipped unless the driver declares
// capabilities.integerUserIds (Guren).
import { describe, expect, it } from 'bun:test'
import { loadDriver } from '../../drivers/index.ts'

const driver = loadDriver()

describe.skipIf(!driver.capabilities.integerUserIds)('GET /api/posts integer author ids (extra)', () => {
  it('rejects page=0|abc and author=abc|0 with exactly 422 and a JSON body', async () => {
    for (const url of ['/api/posts?page=0', '/api/posts?page=abc', '/api/posts?author=abc', '/api/posts?author=0']) {
      const res = await driver.raw(driver.newClient(), 'GET', url, { headers: { Accept: 'application/json' } })
      expect(res.status, url).toBe(422)
      expect(res.headers.get('content-type') ?? '', url).toContain('application/json')
      await res.json()
    }
  })
})
