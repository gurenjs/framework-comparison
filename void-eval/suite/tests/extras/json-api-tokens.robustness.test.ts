// Robustness extra (not graded): a guest cannot revoke a token, revoking a
// missing token and odd input never answer 5xx, and a token name that is not a
// string is refused like any other invalid name.
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../../drivers/index.ts'
import type { Driver } from '../../drivers/types.ts'
import { makeUser, type TestUser } from '../../lib/fixtures.ts'
import { isGuestRefusal, isServerError } from '../../lib/robust.ts'
import { apiRequest, apiTokenRows, jsonValidationStatuses, locationPath, sessionRequest } from '../../drivers/ext/json-api-tokens.ts'

describe('API tokens: robustness (extra)', () => {
  let driver: Driver
  beforeAll(() => {
    driver = loadDriver()
  })

  async function createToken(user: TestUser, name = 'robust') {
    const res = await sessionRequest(driver, user.client, 'POST', '/profile/tokens', { name })
    expect(res.status).toBe(201)
    return res.json as { id: string | number; token: string }
  }

  it("refuses a guest's revoke and the token keeps working", async () => {
    const owner = await makeUser(driver, { tag: 'rk' })
    const { id, token } = await createToken(owner)
    const res = await sessionRequest(driver, driver.newClient(), 'DELETE', `/profile/tokens/${encodeURIComponent(String(id))}`)
    expect(isGuestRefusal({ status: res.status, location: locationPath(res) }), `revoke: ${res.status}`).toBe(true)
    const use = await apiRequest(driver, 'GET', '/api/posts', `Bearer ${token}`)
    expect(use.status).toBe(200)
  })

  it('answers the revoke of a missing token with 404', async () => {
    const owner = await makeUser(driver, { tag: 'rk' })
    const res = await sessionRequest(driver, owner.client, 'DELETE', '/profile/tokens/99999999')
    expect(res.status).toBe(404)
  })

  it('refuses a token name that is not a string and stores nothing', async () => {
    const owner = await makeUser(driver, { tag: 'rk' })
    const before = apiTokenRows(driver).length
    for (const name of [123, ['a'], { n: 1 }, null]) {
      const res = await sessionRequest(driver, owner.client, 'POST', '/profile/tokens', { name })
      expect(jsonValidationStatuses(driver), `name ${JSON.stringify(name)}: ${res.status}`).toContain(res.status)
    }
    expect(apiTokenRows(driver).length).toBe(before)
  })

  it('answers a malformed API body without a server error', async () => {
    const owner = await makeUser(driver, { tag: 'rk' })
    const { token } = await createToken(owner)
    const res = await driver.raw(driver.newClient(), 'POST', '/api/posts', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{"title": ',
    })
    expect(isServerError(res), `status ${res.status}`).toBe(false)
  })
})
