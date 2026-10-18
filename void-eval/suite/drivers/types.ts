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

/** One simulated browser: a cookie jar. */
export interface Client {
  jar: CookieJar
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

/** A page read through the framework's page-data protocol (Inertia JSON / Void page JSON). */
export interface PageResult {
  status: number
  component: string | null
  props: Record<string, any> | null
}

/** A submitted mutation: the result plus the redirect pathname (query dropped) and the response headers. */
export type Submit = MutationResult & { location: string | null; headers: Headers }

export interface MutateOptions {
  /** Extra request headers (e.g. Referer), added after the framework's own; they cannot replace them. */
  headers?: Record<string, string>
  /**
   * Send as the framework's page client (default) or as a plain JSON client
   * (`false`: no X-VoidPages on Void; Guren never sends X-Inertia on
   * mutations). Page-object validation errors are only read for page requests.
   */
  pages?: boolean
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
  /** Page component names of the base app's post list and post page. */
  readonly components: { postIndex: string; postShow: string }
  /** The status a page-form validation failure answers with (Guren 422 JSON, Void 200 page data). */
  readonly formValidationStatus: number

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

  /** Submit the edit-post form (Guren: PUT /posts/:id; Void: PUT /posts/:id?update) with `data` verbatim. */
  updatePost(client: Client, id: Id, data: Record<string, unknown>): Promise<Submit>

  /** The account id of a registered user, read from the base app's users table by email. Throws when there is no such row. */
  userIdByEmail(email: string): Id

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
   * `redirect: 'manual'`, and adds no headers. (The Void driver re-sends once
   * when `vp dev` answers with its own "fetch failed" page; see void.ts.)
   */
  raw(client: Client, method: string, path: string, init?: RequestInit): Promise<Response>

  /**
   * Run SQL directly on the app's SQLite database (lib/db.ts). Only for
   * contracts the task pins at the table level; prefer HTTP everywhere else.
   */
  sql<T = Record<string, unknown>>(query: string, params?: unknown[]): T[]

  /**
   * Generic building blocks for task-specific helpers (drivers/ext/*.ts):
   * `mutate` submits a form the way the framework's client does (Guren:
   * CSRF header, JSON, no Inertia header -> 422 JSON on validation failure;
   * Void: Origin + X-VoidPages, validation failure -> 200 page JSON with
   * errors). A request refused by the framework's own CSRF/origin check
   * throws (a harness bug, never app behaviour). `ok` is always false here;
   * callers decide success. `page` reads page data.
   */
  mutate(client: Client, method: string, path: string, body?: unknown, opts?: MutateOptions): Promise<Submit>
  page(client: Client, path: string): Promise<PageResult>
}
