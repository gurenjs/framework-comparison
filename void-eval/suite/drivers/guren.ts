// Guren driver: the blog app built with create-guren-app (Bun + Hono +
// Inertia React). Framework specifics handled here:
//
// - CSRF: the app sets an `XSRF-TOKEN` cookie on responses (guest tokens are
//   stateless double-submit; after sign-in the token is bound to the
//   `guren.session` id and is re-issued on the login/register redirect). Every
//   mutating request sends the *current* cookie value, URL-decoded, as the
//   `X-XSRF-TOKEN` header — what the Inertia/axios client does. A rejected
//   token yields `403 {"message":"CSRF token mismatch"}`; the driver throws on
//   that so a harness problem can never pass for an authorization 403.
// - Reads: pages are Inertia responses. Sending `X-Inertia: true` plus the
//   current `X-Inertia-Version` returns the page object as JSON
//   (`{ component, props, url, version }`). A stale/missing version gets
//   `409`; the driver then learns the version from a plain HTML GET's
//   `X-Inertia-Version` header and retries once.
// - Mutations: sent with real verbs (PUT/DELETE — the Inertia client does not
//   method-spoof) and a JSON body, *without* `X-Inertia`, i.e. as a plain HTTP
//   client. That keeps validation failures as `422 { message, errors }` JSON
//   (with `X-Inertia` Guren would instead flash the errors and 303 back).

import { CookieJar } from '../lib/cookies.ts'
import type {
  Client,
  Id,
  Credentials,
  Driver,
  ListResult,
  MutationResult,
  NewPost,
  NewUser,
  PostView,
  ProfileView,
} from './types.ts'

interface InertiaPage {
  component: string
  props: Record<string, any>
}

export class GurenDriver implements Driver {
  readonly name = 'guren'
  readonly capabilities = { profilePassword: true, integerUserIds: true }
  private inertiaVersion: string | null = null

  constructor(readonly baseUrl: string) {}

  newClient(): Client {
    return { jar: new CookieJar(), state: {} }
  }

  async raw(client: Client, method: string, path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    const cookie = client.jar.header()
    if (cookie) headers.set('Cookie', cookie)
    const res = await fetch(new URL(path, this.baseUrl), { ...init, method, headers, redirect: 'manual' })
    client.jar.store(res)
    return res
  }

  // --- internals -----------------------------------------------------------

  private async ensureCsrf(client: Client): Promise<void> {
    if (!client.jar.has('XSRF-TOKEN')) {
      await (await this.raw(client, 'GET', '/health')).arrayBuffer()
    }
    if (!client.jar.has('XSRF-TOKEN')) throw new Error('guren driver: no XSRF-TOKEN cookie after GET /health')
  }

  private async mutate(client: Client, method: string, path: string, body?: unknown): Promise<MutationResult & { location: string | null }> {
    await this.ensureCsrf(client)
    const headers: Record<string, string> = {
      'X-XSRF-TOKEN': decodeURIComponent(client.jar.get('XSRF-TOKEN')!),
      Accept: 'application/json',
    }
    const init: RequestInit = { headers }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const res = await this.raw(client, method, path, init)
    const bodyText = await res.text()
    if (res.status === 403 && bodyText.includes('CSRF token mismatch')) {
      throw new Error(`guren driver: ${method} ${path} was rejected by CSRF (harness bug, not app behaviour)`)
    }
    let errors: Record<string, unknown> = {}
    if (res.status === 422) {
      try {
        errors = (JSON.parse(bodyText) as { errors?: Record<string, unknown> }).errors ?? {}
      } catch {}
    }
    const location = res.headers.get('location')
    return { status: res.status, ok: false, errors, bodyText, location: location ? new URL(location, this.baseUrl).pathname : null }
  }

  /** GET an Inertia page as JSON. `page` is null when the response is not a 200 page object. */
  private async visit(client: Client, path: string): Promise<{ status: number; page: InertiaPage | null; location: string | null }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers: Record<string, string> = {
        'X-Inertia': 'true',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'text/html, application/xhtml+xml',
      }
      if (this.inertiaVersion) headers['X-Inertia-Version'] = this.inertiaVersion
      const res = await this.raw(client, 'GET', path, { headers })
      if (res.status === 409 && attempt === 0) {
        await res.arrayBuffer()
        const html = await this.raw(client, 'GET', path, { headers: { Accept: 'text/html' } })
        await html.arrayBuffer()
        this.inertiaVersion = html.headers.get('x-inertia-version')
        continue
      }
      const location = res.headers.get('location')
      const type = res.headers.get('content-type') ?? ''
      if (res.status === 200 && type.includes('application/json')) {
        return { status: 200, page: (await res.json()) as InertiaPage, location }
      }
      await res.arrayBuffer()
      return { status: res.status, page: null, location }
    }
    throw new Error(`guren driver: GET ${path} kept answering 409 (Inertia version mismatch)`)
  }

  // --- Driver --------------------------------------------------------------

  async register(client: Client, user: NewUser): Promise<void> {
    const res = await this.mutate(client, 'POST', '/register', {
      name: user.name,
      email: user.email,
      password: user.password,
      passwordConfirmation: user.password,
    })
    if (![302, 303].includes(res.status) || res.location?.includes('/register')) {
      throw new Error(`guren driver: register ${user.email} failed: ${res.status} ${res.bodyText.slice(0, 300)}`)
    }
  }

  async login(client: Client, creds: Credentials): Promise<{ ok: boolean; status: number }> {
    const res = await this.mutate(client, 'POST', '/login', { email: creds.email, password: creds.password })
    if (![302, 303].includes(res.status)) return { ok: false, status: res.status }
    // A redirect alone is not proof (the guest middleware also redirects a
    // client that is already signed in), so confirm the session is that user.
    const profile = await this.getProfile(client)
    return { ok: profile?.email === creds.email.trim().toLowerCase(), status: res.status }
  }

  async createPost(client: Client, post: NewPost): Promise<{ id: Id }> {
    const res = await this.mutate(client, 'POST', '/posts', post)
    const id = Number(/\/posts\/(\d+)$/.exec(res.location ?? '')?.[1])
    if (![302, 303].includes(res.status) || !Number.isInteger(id)) {
      throw new Error(`guren driver: createPost failed: ${res.status} location=${res.location} ${res.bodyText.slice(0, 300)}`)
    }
    return { id }
  }

  async deletePost(client: Client, id: Id): Promise<MutationResult> {
    const { location: _location, ...rest } = await this.mutate(client, 'DELETE', `/posts/${id}`)
    // Guren's success contract (hidden test): a redirect, 302 or 303.
    return { ...rest, ok: [302, 303].includes(rest.status) }
  }

  async getPostStatus(client: Client, id: Id): Promise<number> {
    return (await this.visit(client, `/posts/${id}`)).status
  }

  async getPost(client: Client, id: Id): Promise<PostView | null> {
    const { page } = await this.visit(client, `/posts/${id}`)
    const post = page?.props.post
    if (!post) return null
    return { id: post.id, title: post.title, author: post.author ?? null }
  }

  async listPosts(client: Client, opts: { page?: number } = {}): Promise<ListResult> {
    const path = opts.page === undefined ? '/posts' : `/posts?page=${opts.page}`
    const { status, page } = await this.visit(client, path)
    if (status !== 200 || !page || page.component !== 'posts/Index') {
      throw new Error(`guren driver: GET ${path} did not return the posts/Index page (status ${status}, component ${page?.component})`)
    }
    const meta = page.props.pagination?.meta ?? {}
    return {
      status,
      ids: (page.props.data as Array<{ id: Id }>).map((p) => p.id),
      meta: {
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
        perPage: meta.perPage,
        total: meta.total,
        from: meta.from ?? null,
        to: meta.to ?? null,
      },
    }
  }

  async getProfile(client: Client): Promise<ProfileView | null> {
    const { page } = await this.visit(client, '/profile')
    const profile = page?.component === 'profile/Edit' ? page.props.profile : null
    return profile ? { name: profile.name, email: profile.email } : null
  }

  async updateProfile(client: Client, body: Record<string, unknown>): Promise<MutationResult> {
    const { location: _location, ...rest } = await this.mutate(client, 'PUT', '/profile', body)
    // Guren's contract (hidden test): validation failure is exactly 422 with
    // JSON `{ errors }` (errors are only parsed on 422); success is 200/302/303.
    return { ...rest, ok: [200, 302, 303].includes(rest.status) }
  }

  absentUserId(): Id {
    return 2_000_000_000
  }
}
