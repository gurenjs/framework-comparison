// Framework-neutral fixture helpers built only on the Driver contract.
import type { Client, Driver, NewPost } from '../drivers/types.ts'

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
let seq = 0

/** A unique, valid, lowercase email for this process. */
export function uniqueEmail(tag = 'user'): string {
  seq += 1
  return `${tag}-${RUN}-${seq}@example.com`
}

export const PASSWORD = 'secret-password'

export interface TestUser {
  client: Client
  name: string
  email: string
  password: string
}

/** Register a brand-new account; the returned client is signed in as it. */
export async function makeUser(driver: Driver, opts: { name?: string; tag?: string } = {}): Promise<TestUser> {
  seq += 1
  const user = { name: opts.name ?? `User ${seq}`, email: uniqueEmail(opts.tag), password: PASSWORD }
  const client = driver.newClient()
  await driver.register(client, user)
  return { client, ...user }
}

export function postFixture(i: number | string, overrides: Partial<NewPost> = {}): NewPost {
  return {
    title: overrides.title ?? `Post ${i}`,
    excerpt: overrides.excerpt ?? `Excerpt ${i}`,
    body: overrides.body ?? `Body ${i}`,
  }
}

/** Fail loudly (as a harness error) when the app does not start with an empty posts table. */
export async function requireNoPosts(driver: Driver): Promise<void> {
  const { meta } = await driver.listPosts(driver.newClient())
  if (meta.total !== 0) {
    throw new Error(`suite precondition: expected an empty posts table at start, found ${meta.total} post(s). Boot the app on a fresh database.`)
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
