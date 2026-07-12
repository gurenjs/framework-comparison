import { createApp } from '../src/server/app'
import { createDb } from '../src/server/db'

export function createTestApp() {
  const db = createDb(':memory:')
  return { app: createApp(db), db }
}

type App = ReturnType<typeof createTestApp>['app']

// Browsers send an Origin header on every non-GET fetch; the csrf()
// middleware relies on it, so the tests send it too.
const ORIGIN = 'http://localhost'

export function json(method: string, data: unknown, cookie?: string): RequestInit {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(data),
  }
}

export function del(cookie: string): RequestInit {
  return { method: 'DELETE', headers: { Cookie: cookie, Origin: ORIGIN } }
}

/** Extracts the session cookie pair ("name=value") from a Set-Cookie header. */
export function sessionCookie(res: Response): string {
  const header = res.headers.get('set-cookie')
  const pair = header?.split(';')[0]
  if (!pair) throw new Error('Expected a Set-Cookie header')
  return pair
}

export async function register(
  app: App,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<{ cookie: string; userId: number }> {
  const res = await app.request(
    '/api/auth/register',
    json('POST', {
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
      ...overrides,
    }),
  )
  if (res.status !== 201) throw new Error(`Registration failed with status ${res.status}`)
  const { user } = (await res.json()) as { user: { id: number } }
  return { cookie: sessionCookie(res), userId: user.id }
}

export async function createPost(
  app: App,
  cookie: string,
  overrides: Partial<{ title: string; body: string }> = {},
): Promise<{ id: number; title: string; body: string }> {
  const res = await app.request(
    '/api/posts',
    json('POST', { title: 'Hello world', body: 'First post body', ...overrides }, cookie),
  )
  if (res.status !== 201) throw new Error(`Post creation failed with status ${res.status}`)
  const { post } = (await res.json()) as { post: { id: number; title: string; body: string } }
  return post
}
