// Driver contract for the black-box acceptance suite.
//
// Tests in ../tests/ only ever talk to the app under test through a Driver.
// Everything framework-specific (CSRF handshake, Inertia headers/version,
// session cookie names, how a created post's id is discovered, how list pages
// expose their data) lives inside the driver. The tests assert on the
// normalized shapes below plus HTTP status codes.
//
// Every request a driver makes MUST use `redirect: 'manual'` so redirect
// statuses (302/303) stay observable, and MUST go through the Client's cookie
// jar so sessions behave like a real browser.

import type { CookieJar } from '../lib/cookies.ts'

/** One simulated browser: a cookie jar plus free-form per-driver state. */
export interface Client {
  jar: CookieJar
  /** Driver-private scratch space (e.g. a cached token). Tests never read it. */
  state: Record<string, unknown>
}

/** Record ids: Guren uses integer autoincrement ids, Void (Better Auth) string ids. Tests only compare them. */
export type Id = string | number

export interface Credentials {
  email: string
  password: string
}

export interface NewUser extends Credentials {
  name: string
}

export interface NewPost {
  title: string
  excerpt: string
  body: string
}

/** Pagination meta of a post list page, normalized. */
export interface ListMeta {
  currentPage: number
  lastPage: number
  perPage: number
  total: number
  /** 1-based index of the first item on this page; null when the page is empty. */
  from: number | null
  /** 1-based index of the last item on this page; null when the page is empty. */
  to: number | null
}

export interface ListResult {
  status: number
  /** Post ids in the order the page shows them. */
  ids: Id[]
  meta: ListMeta
}

export interface PostView {
  id: Id
  title: string
  /** `id` must be the same value the app uses for `?author=` filters. */
  author: { id?: Id; name?: string } | null
}

export interface ProfileView {
  name: string
  email: string
}

export interface MutationResult {
  /** Raw HTTP status (redirects not followed). */
  status: number
  /**
   * The framework's own notion of "this mutation succeeded" — each driver
   * enforces its framework's expected success status here (Guren: 302/303
   * for delete, 200/302/303 for the profile update), so tests stay identical.
   * A validation rejection is always `ok: false`.
   */
  ok: boolean
  /**
   * Field-keyed validation errors (`{ email: [...] }` or `{ email: '...' }`)
   * when the server rejected the input as invalid; `{}` otherwise. The driver
   * only fills this for its framework's real validation-failure shape
   * (Guren: 422 JSON `{ errors }`; Void: 200 page JSON with `errors`), so a
   * non-empty `errors` means "rejected by validation".
   */
  errors: Record<string, unknown>
  /** Raw response body text, for diagnostics in assertion messages. */
  bodyText: string
}

export interface DriverCapabilities {
  /**
   * The profile form has an optional `password` field (Guren: yes, Void: no).
   * When false, tests never send `password` in a profile update.
   */
  profilePassword: boolean
  /**
   * User ids are positive integers, so `?author=abc` / `?author=0` are
   * malformed (Guren: yes, Void: no — opaque strings). Gates the extra file
   * tests/extras/api-posts-contract.integer-author.test.ts, which is not part of the
   * shared grade.
   */
  integerUserIds: boolean
}

export interface Driver {
  readonly name: string
  readonly baseUrl: string
  readonly capabilities: DriverCapabilities

  /** A fresh, signed-out browser with an empty cookie jar. */
  newClient(): Client

  /**
   * Register an account through the app's sign-up flow. On return the client
   * is signed in as that account. Throws if registration did not succeed.
   */
  register(client: Client, user: NewUser): Promise<void>

  /**
   * Sign in through the app's login flow. `ok` is true iff the credentials
   * were accepted (client now signed in). Must not throw on bad credentials.
   */
  login(client: Client, creds: Credentials): Promise<{ ok: boolean; status: number }>

  /** Create a post as the signed-in user. Throws if it was not created. */
  createPost(client: Client, post: NewPost): Promise<{ id: Id }>

  /**
   * Send the app's "delete post" request (Guren: DELETE /posts/:id; Void:
   * DELETE /posts/:id?delete) exactly as an HTTP client with a valid session
   * (+ CSRF token where the framework needs one) would. Tests assert the raw
   * status for refusals (403 non-author; 302/401/403 guest) and `ok` for the
   * author's own delete.
   */
  deletePost(client: Client, id: Id): Promise<MutationResult>

  /** Status of the post's public page (200 when it exists, 404 when not). */
  getPostStatus(client: Client, id: Id): Promise<number>

  /** The post as its public page presents it; null when the page is not 200. */
  getPost(client: Client, id: Id): Promise<PostView | null>

  /**
   * The public post list page (Guren: GET /posts[?page=N]). `page` omitted
   * means "no page parameter at all". Throws if the page is not a 200 list.
   */
  listPosts(client: Client, opts?: { page?: number }): Promise<ListResult>

  /** The signed-in user's profile as the profile page shows it; null if the page is not reachable (e.g. redirected to login). */
  getProfile(client: Client): Promise<ProfileView | null>

  /**
   * Submit the profile update (Guren: PUT /profile) with `body` sent verbatim
   * as the request payload, exactly as an HTTP client with a valid session +
   * CSRF token would — extra keys included. Tests check `ok`/`errors`, never
   * the status, because frameworks report validation failure differently.
   */
  updateProfile(client: Client, body: Record<string, unknown>): Promise<MutationResult>

  /**
   * A well-formed user id that belongs to no account (and so to no post):
   * Guren a large unused integer, Void a fresh random string id.
   */
  absentUserId(): Id

  /**
   * Escape hatch for public, framework-neutral endpoints whose contract is
   * itself under test (e.g. GET /api/posts). Uses the client's cookies,
   * `redirect: 'manual'`, and adds nothing else.
   */
  raw(client: Client, method: string, path: string, init?: RequestInit): Promise<Response>
}
