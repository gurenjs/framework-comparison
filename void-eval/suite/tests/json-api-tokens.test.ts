// Port of agents-on-guren tasks/json-api-tokens/hidden/json-api-tokens.test.ts
// (10 cases, the same as the hidden test). Framework differences live in
// drivers/ext/json-api-tokens.ts.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { loadDriver } from '../drivers/index.ts'
import type { Driver, Id } from '../drivers/types.ts'
import { makeUser, type TestUser } from '../lib/fixtures.ts'
import {
  apiRequest,
  apiTokenCells,
  apiTokenRows,
  devServerRetries,
  findPost,
  insertPost,
  isJson,
  jsonValidationStatuses,
  locationPath,
  postCount,
  sessionRequest,
  userId,
  type Sent,
} from '../drivers/ext/json-api-tokens.ts'

interface CreatedToken {
  id: string | number
  name: string
  token: string
}

interface ApiPost {
  id: number
  title: string
  excerpt: string
  authorId: Id
  createdAt: string
}

// A fixed instant in the past, so fixture timestamps never tie with rows the
// requests under test create "now".
const BASE = Date.parse('2024-01-01T00:00:00.000Z')

// One server and one database for the whole file (the hidden test also
// resets only once). Every case registers fresh users.
let driver: Driver

beforeAll(() => {
  driver = loadDriver()
})

afterAll(() => {
  // Void only: requests re-sent after the dev server's own "fetch failed" page (see the ext file).
  if (devServerRetries() > 0) console.log(`suite: ${devServerRetries()} request(s) re-sent after a dev-server "fetch failed" page`)
})

function postToken(user: TestUser, name: unknown): Promise<Sent> {
  return sessionRequest(driver, user.client, 'POST', '/profile/tokens', name === undefined ? {} : { name })
}

async function createToken(user: TestUser, name = 'deploy script'): Promise<CreatedToken> {
  const res = await postToken(user, name)
  expect(res.status).toBe(201)
  expect(isJson(res)).toBe(true)
  const body = res.json as CreatedToken
  expect(typeof body.token).toBe('string')
  expect(body.token.length).toBeGreaterThanOrEqual(16)
  expect(body.id === undefined || body.id === null).toBe(false)
  return body
}

/** A request carrying only the bearer header: no session cookie, so the token is the only credential. */
function bearer(token: string, method: string, path: string, body?: unknown): Promise<Sent> {
  return apiRequest(driver, method, path, `Bearer ${token}`, body)
}

function revoke(user: TestUser, id: string | number): Promise<Sent> {
  return sessionRequest(driver, user.client, 'DELETE', `/profile/tokens/${encodeURIComponent(String(id))}`)
}

describe('personal API tokens', () => {
  it('creates a token as JSON, shows the plain text once, and stores only a hash of it', async () => {
    const user = await makeUser(driver)
    const before = apiTokenRows(driver).length

    const res = await postToken(user, 'deploy script')
    expect(res.status).toBe(201)
    expect(isJson(res)).toBe(true)
    const created = res.json as CreatedToken
    expect(created.name).toBe('deploy script')
    expect(typeof created.token).toBe('string')
    expect(created.token.length).toBeGreaterThanOrEqual(16)
    expect(created.id === undefined || created.id === null).toBe(false)

    expect(apiTokenRows(driver).length).toBe(before + 1)

    // A token may carry a public selector before a `|` (the selector may be
    // stored as is); the secret after it, and the whole token, must not be.
    const secret = created.token.split('|').pop() ?? created.token
    expect(secret.length).toBeGreaterThanOrEqual(16)
    for (const cell of apiTokenCells(driver)) {
      expect(cell.includes(created.token)).toBe(false)
      expect(cell.includes(secret)).toBe(false)
    }

    const listed = await bearer(created.token, 'GET', '/api/posts')
    expect(listed.status).toBe(200)
  })

  it('refuses a token name that is missing, empty or longer than 50 characters', async () => {
    const user = await makeUser(driver)
    const before = apiTokenRows(driver).length

    for (const name of [undefined, '', 'x'.repeat(51)]) {
      const res = await postToken(user, name)
      expect(jsonValidationStatuses(driver)).toContain(res.status)
    }
    expect(apiTokenRows(driver).length).toBe(before)

    const longest = await createToken(user, 'y'.repeat(50))
    expect(longest.name).toBe('y'.repeat(50))
  })

  it('does not let a guest create a token', async () => {
    const before = apiTokenRows(driver).length
    const guest = driver.newClient()
    const res = await sessionRequest(driver, guest, 'POST', '/profile/tokens', { name: 'sneaky' })

    expect([302, 303, 401]).toContain(res.status)
    if (res.status !== 401) expect(locationPath(res)).toBe('/login')
    expect(apiTokenRows(driver).length).toBe(before)
  })

  it("revokes a token with 204, after which it is refused while the owner's other tokens keep working", async () => {
    const user = await makeUser(driver)
    const doomed = await createToken(user, 'old laptop')
    const kept = await createToken(user, 'ci')
    expect((await bearer(doomed.token, 'GET', '/api/posts')).status).toBe(200)

    const res = await revoke(user, doomed.id)
    expect(res.status).toBe(204)

    const refused = await bearer(doomed.token, 'GET', '/api/posts')
    expect(refused.status).toBe(401)
    expect(isJson(refused)).toBe(true)
    expect((await bearer(kept.token, 'GET', '/api/posts')).status).toBe(200)
  })

  it("answers 404 when revoking another user's token, and that token keeps working", async () => {
    const owner = await makeUser(driver)
    const intruder = await makeUser(driver)
    const token = await createToken(owner, 'owner token')

    const res = await revoke(intruder, token.id)
    expect(res.status).toBe(404)

    expect((await bearer(token.token, 'GET', '/api/posts')).status).toBe(200)
  })
})

describe('JSON posts API', () => {
  it("lists every author's posts newest first with the pinned fields", async () => {
    const alice = await makeUser(driver, { name: 'Alice' })
    const bob = await makeUser(driver, { name: 'Bob' })
    const aliceId = userId(driver, alice)
    const bobId = userId(driver, bob)
    const seeded: Array<{ id: number; title: string; excerpt: string; authorId: Id; createdAt: string }> = []
    for (let i = 1; i <= 3; i++) {
      const createdAt = new Date(BASE + i * 60_000).toISOString()
      const authorId = i === 2 ? bobId : aliceId
      const id = insertPost(driver, { title: `Post ${i}`, excerpt: `Excerpt ${i}`, body: `Body ${i}`, authorId, createdAt })
      seeded.push({ id, title: `Post ${i}`, excerpt: `Excerpt ${i}`, authorId, createdAt })
    }
    const { token } = await createToken(alice)

    const res = await bearer(token, 'GET', '/api/posts')
    expect(res.status).toBe(200)
    expect(isJson(res)).toBe(true)
    const body = res.json as { data: ApiPost[] }
    expect(Array.isArray(body.data)).toBe(true)

    const seededIds = new Set(seeded.map((post) => post.id))
    const listed = body.data.filter((post) => seededIds.has(post.id))
    expect(listed.map((post) => post.id)).toEqual([...seeded].reverse().map((post) => post.id))

    for (const post of listed) {
      const expected = seeded.find((candidate) => candidate.id === post.id)!
      expect(post.title).toBe(expected.title)
      expect(post.excerpt).toBe(expected.excerpt)
      expect(post.authorId).toBe(expected.authorId)
      expect(typeof post.createdAt).toBe('string')
      expect(Date.parse(post.createdAt)).toBe(Date.parse(expected.createdAt))
    }
  })

  it("creates a post as the token's owner and answers 201 with the post", async () => {
    const owner = await makeUser(driver)
    const other = await makeUser(driver)
    const ownerId = userId(driver, owner)
    const { token } = await createToken(owner)

    const res = await bearer(token, 'POST', '/api/posts', {
      title: 'From a script',
      excerpt: 'Posted over the API',
      body: 'Written by a cron job.',
      authorId: userId(driver, other),
    })
    expect(res.status).toBe(201)
    expect(isJson(res)).toBe(true)
    const { data } = res.json as { data: ApiPost }
    expect(typeof data.id).toBe('number')
    expect(data.title).toBe('From a script')
    expect(data.excerpt).toBe('Posted over the API')
    expect(data.authorId).toBe(ownerId)
    expect(Number.isNaN(Date.parse(data.createdAt))).toBe(false)

    const stored = findPost(driver, data.id)
    expect(stored?.title).toBe('From a script')
    expect(stored?.body).toBe('Written by a cron job.')
    expect(stored?.author_id).toBe(ownerId)
  })

  it('rejects an invalid post with a JSON validation error and creates nothing', async () => {
    const owner = await makeUser(driver)
    const { token } = await createToken(owner)
    const before = postCount(driver)

    for (const payload of [
      { title: '', excerpt: 'An excerpt', body: 'A body.' },
      { title: 'No body', excerpt: 'An excerpt' },
    ]) {
      const res = await bearer(token, 'POST', '/api/posts', payload)
      expect(jsonValidationStatuses(driver)).toContain(res.status)
      expect(isJson(res)).toBe(true)
    }
    expect(postCount(driver)).toBe(before)
  })

  it('answers 401 JSON to a missing, malformed, unknown or tampered token and creates nothing', async () => {
    const owner = await makeUser(driver)
    const { token } = await createToken(owner)
    const before = postCount(driver)
    const tampered = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`
    const payload = { title: 'Nope', excerpt: 'Nope', body: 'Nope.' }

    for (const credential of ['not-a-real-token', '123|0123456789abcdef0123456789abcdef', tampered]) {
      const read = await bearer(credential, 'GET', '/api/posts')
      expect(read.status).toBe(401)
      expect(isJson(read)).toBe(true)
      const write = await bearer(credential, 'POST', '/api/posts', payload)
      expect(write.status).toBe(401)
      expect(isJson(write)).toBe(true)
    }

    // No bearer credential at all. A read is a 401; a write may instead be
    // stopped earlier by the app's cross-site request protection (403), which
    // the statement allows. Either way nothing is created.
    for (const authorization of [undefined, `Basic ${btoa('user:pass')}`]) {
      const read = await apiRequest(driver, 'GET', '/api/posts', authorization)
      expect(read.status).toBe(401)
      expect(isJson(read)).toBe(true)
      const write = await apiRequest(driver, 'POST', '/api/posts', authorization, payload)
      expect([401, 403]).toContain(write.status)
    }
    expect(postCount(driver)).toBe(before)
  })
})

describe('API rate limit', () => {
  // Assumes a one-minute window that the 61 requests fit inside: they take a
  // few seconds. Starting early in a wall-clock minute keeps a window aligned
  // to clock minutes from splitting the burst, so both kinds of limiter are
  // judged on the same 61 requests.
  it("allows 60 requests per minute per token, answers the 61st with 429 and Retry-After, and keeps each token's own budget", async () => {
    const intoMinute = Date.now() % 60_000
    if (intoMinute > 40_000) await Bun.sleep(60_000 - intoMinute + 250)

    const user = await makeUser(driver)
    const first = await createToken(user, 'busy script')
    const second = await createToken(user, 'quiet script')

    for (let i = 1; i <= 60; i++) {
      const res = await bearer(first.token, 'GET', '/api/posts')
      if (res.status !== 200) throw new Error(`request ${i} of 60 answered ${res.status}`)
    }

    const limited = await bearer(first.token, 'GET', '/api/posts')
    expect(limited.status).toBe(429)
    const retryAfter = limited.headers.get('retry-after')
    expect(retryAfter).not.toBeNull()
    const value = (retryAfter ?? '').trim()
    if (/^\d+$/.test(value)) {
      expect(Number(value)).toBeLessThanOrEqual(60)
    } else {
      expect(Number.isNaN(Date.parse(value))).toBe(false)
    }

    // Same account, different token: its own bucket.
    const other = await bearer(second.token, 'GET', '/api/posts')
    expect(other.status).toBe(200)
  }, 60_000)
})
