// Void driver: the blog app built on Void 1.1.11 (Vite + Cloudflare Workers
// runtime, React pages, D1, Void-managed Better Auth). Framework specifics
// handled here:
//
// - Auth: Better Auth JSON endpoints under /api/auth (sign-up/email,
//   sign-in/email). They refuse requests without an `Origin` header, so every
//   request carries `Origin: <baseUrl>` — what a same-origin browser sends.
//   Void also rejects cross-origin page actions with 403, which the Origin
//   header keeps out of the way.
// - Reads: pages answer with their page object as JSON when the request has
//   `X-VoidPages: true` (`{ component, props, shared, url, errors }`), the
//   header the Void router sends on client navigation.
// - Mutations: page actions with JSON bodies. Updating and deleting a post
//   are named actions (PUT /posts/:id?update, DELETE /posts/:id?delete); the
//   profile is the page's single action (PUT /profile). With `X-VoidPages`,
//   a validation failure is a 200 page object whose `errors` holds the field
//   messages — Void does not answer 422 for page actions.
// - User ids are Better Auth's opaque strings.

import { CookieJar } from '../lib/cookies.ts'
import { sqlAll } from '../lib/db.ts'
import type {
  Client,
  Credentials,
  Driver,
  Id,
  ListResult,
  MutationResult,
  NewPost,
  NewUser,
  PostView,
  MutateOptions,
  PageResult,
  ProfileView,
  Submit,
} from './types.ts'

interface VoidPage {
  component: string
  props: Record<string, any>
  errors: Record<string, unknown> | null
}

export class VoidDriver implements Driver {
  readonly name = 'void'
  readonly capabilities = { profilePassword: false, integerUserIds: false }
  readonly components = { postIndex: 'posts', postShow: 'posts/[id]' }
  readonly formValidationStatus = 200

  constructor(readonly baseUrl: string) {}

  newClient(): Client {
    return { jar: new CookieJar() }
  }

  async raw(client: Client, method: string, path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    const cookie = client.jar.header()
    if (cookie) headers.set('Cookie', cookie)
    const send = () => fetch(new URL(path, this.baseUrl), { ...init, method, headers, redirect: 'manual' })
    let res = await send()
    // `vp dev` sometimes answers the request after one whose body the app
    // never read with Vite's own HTML error page ("fetch failed") instead of
    // forwarding it to the app; the request never reaches the Worker (the
    // json-api-tokens port checked row counts and rate-limit tallies). That is
    // the dev server, not the app under test, so retry exactly that once.
    if (res.status === 500 && !res.headers.get('content-type')) {
      const text = await res.clone().text()
      if (/^\s*<!DOCTYPE html>/i.test(text) && text.includes('"message":"fetch failed"')) {
        console.warn(`suite: ${method} ${path} re-sent after the vp dev "fetch failed" page`)
        res = await send()
      }
    }
    client.jar.store(res)
    return res
  }

  // --- internals -----------------------------------------------------------

  private get origin(): string {
    return new URL(this.baseUrl).origin
  }

  /**
   * A mutation as the Void client sends it: `Origin` always, `X-VoidPages`
   * unless `opts.pages === false` (a plain JSON client, e.g. Better Auth or a
   * JSON route). `errors` is filled only from a page object's validation
   * errors. Requests refused by Void's own origin check throw.
   */
  async mutate(client: Client, method: string, path: string, body?: unknown, opts: MutateOptions = {}): Promise<Submit> {
    const pages = opts.pages ?? true
    const headers: Record<string, string> = { ...opts.headers, Origin: this.origin, Accept: 'application/json' }
    if (pages) headers['X-VoidPages'] = 'true'
    const init: RequestInit = { headers }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const res = await this.raw(client, method, path, init)
    const bodyText = await res.text()
    if (isOriginRejection(res.status, bodyText)) {
      throw new Error(`void driver: ${method} ${path} was rejected by the origin check (harness bug, not app behaviour)`)
    }
    let errors: Record<string, unknown> = {}
    if (pages && (res.status === 200 || res.status === 422)) {
      try {
        errors = (JSON.parse(bodyText) as Partial<VoidPage>).errors ?? {}
      } catch {}
    }
    const location = res.headers.get('location')
    return { status: res.status, ok: false, errors, bodyText, location: location ? new URL(location, this.baseUrl).pathname : null, headers: res.headers }
  }

  private async visitRaw(client: Client, path: string): Promise<{ status: number; page: VoidPage | null }> {
    const res = await this.raw(client, 'GET', path, { headers: { 'X-VoidPages': 'true', Accept: 'application/json' } })
    const type = res.headers.get('content-type') ?? ''
    if (res.status === 200 && type.includes('application/json')) {
      return { status: 200, page: (await res.json()) as VoidPage }
    }
    await res.arrayBuffer()
    return { status: res.status, page: null }
  }

  // --- Driver --------------------------------------------------------------

  async register(client: Client, user: NewUser): Promise<void> {
    const res = await this.mutate(client, 'POST', '/api/auth/sign-up/email', {
      name: user.name,
      email: user.email,
      password: user.password,
    }, { pages: false })
    if (res.status !== 200 || !client.jar.names().some((n) => n.includes('session_token'))) {
      throw new Error(`void driver: register ${user.email} failed: ${res.status} ${res.bodyText.slice(0, 300)}`)
    }
  }

  async login(client: Client, creds: Credentials): Promise<{ ok: boolean; status: number }> {
    const res = await this.mutate(client, 'POST', '/api/auth/sign-in/email', { email: creds.email, password: creds.password }, { pages: false })
    if (res.status !== 200) return { ok: false, status: res.status }
    const profile = await this.getProfile(client)
    return { ok: profile?.email === creds.email.trim().toLowerCase(), status: res.status }
  }

  async createPost(client: Client, post: NewPost): Promise<{ id: Id }> {
    const res = await this.mutate(client, 'POST', '/posts', post)
    const id = Number(/\/posts\/(\d+)$/.exec(res.location ?? '')?.[1])
    if (![302, 303].includes(res.status) || !Number.isInteger(id)) {
      throw new Error(`void driver: createPost failed: ${res.status} location=${res.location} ${res.bodyText.slice(0, 300)}`)
    }
    return { id }
  }

  async deletePost(client: Client, id: Id): Promise<MutationResult> {
    const res = await this.mutate(client, 'DELETE', `/posts/${id}?delete`)
    // Void's success contract: the action redirects (302) to the list.
    return { ...res, ok: [302, 303].includes(res.status) }
  }

  updatePost(client: Client, id: Id, data: Record<string, unknown>): Promise<Submit> {
    return this.mutate(client, 'PUT', `/posts/${id}?update`, data)
  }

  async getPostStatus(client: Client, id: Id): Promise<number> {
    return (await this.visitRaw(client, `/posts/${id}`)).status
  }

  async getPost(client: Client, id: Id): Promise<PostView | null> {
    const { page } = await this.visitRaw(client, `/posts/${id}`)
    const post = page?.props.post
    if (!post) return null
    return { id: post.id, title: post.title, author: post.author ?? null }
  }

  async listPosts(client: Client, opts: { page?: number } = {}): Promise<ListResult> {
    const path = opts.page === undefined ? '/posts' : `/posts?page=${opts.page}`
    const { status, page } = await this.visitRaw(client, path)
    if (status !== 200 || !page || page.component !== this.components.postIndex) {
      throw new Error(`void driver: GET ${path} did not return the posts page (status ${status}, component ${page?.component})`)
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
    const { page } = await this.visitRaw(client, '/profile')
    const profile = page?.component === 'profile' ? page.props.profile : null
    return profile ? { name: profile.name, email: profile.email } : null
  }

  async updateProfile(client: Client, body: Record<string, unknown>): Promise<MutationResult> {
    const res = await this.mutate(client, 'PUT', '/profile', body)
    // Void's contract: success re-runs the loader (200 page object, no
    // errors) or redirects; validation failure is a page object with errors.
    const rejected = Object.keys(res.errors).length > 0
    return { ...res, ok: !rejected && [200, 302, 303].includes(res.status) }
  }

  absentUserId(): Id {
    return `absent${crypto.randomUUID().replaceAll('-', '')}`
  }

  /** Better Auth keeps accounts in the `user` table, with string ids. */
  userIdByEmail(email: string): Id {
    const rows = this.sql<{ id: Id }>('SELECT id FROM "user" WHERE email = ?', [email])
    if (rows.length !== 1) throw new Error(`void driver: no account row for ${email}`)
    return rows[0]!.id
  }

  sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): T[] {
    const appDir = process.env.SUITE_APP_DIR
    if (!appDir) throw new Error('SUITE_APP_DIR is not set (run.sh sets it)')
    return sqlAll<T>('void', appDir, query, params)
  }

  /** Any page as `{ status, component, props, errors }`; component/props are null when the response is not a 200 page object. */
  async page(client: Client, path: string): Promise<PageResult> {
    const { status, page } = await this.visitRaw(client, path)
    return { status, component: page?.component ?? null, props: page?.props ?? null }
  }
}

/**
 * Void's own origin refusals, matched exactly so an app's 403 is never taken
 * for one: page actions answer "Cross-origin page actions are not allowed."
 * (void/dist protocol), Better Auth answers JSON with an origin error code.
 */
function isOriginRejection(status: number, bodyText: string): boolean {
  if (status !== 403) return false
  if (bodyText.includes('Cross-origin page actions are not allowed.')) return true
  try {
    const code = (JSON.parse(bodyText) as { code?: unknown }).code
    return code === 'MISSING_OR_NULL_ORIGIN' || code === 'INVALID_ORIGIN'
  } catch {
    return false
  }
}
