# Integration request: public JSON feed of posts at `GET /api/posts`

**Requested by:** partner integrations (external consumer) + our front-end team
**Priority:** normal

## Background

A partner wants to embed our latest posts on their site. Today the only way
to get at posts is the HTML pages, which they cannot consume. They
have asked for a plain, unauthenticated JSON endpoint that lists posts,
newest first, in pages of 10, optionally narrowed to a single author.

## What we want

`GET /api/posts` returns JSON — no sign-in, no session, no CSRF token — with
this envelope:

```json
{
  "data": [
    {
      "id": 42,
      "title": "…",
      "excerpt": "…",
      "createdAt": "2026-08-01T12:34:56.000Z",
      "author": { "id": "Xy3…", "name": "Alice" }
    }
  ],
  "meta": { "currentPage": 1, "lastPage": 3, "perPage": 10, "total": 27 }
}
```

- `data` holds the posts for the requested page, **newest first**, at most
  **10 per page**. Each post carries the same fields the site's own pages
  receive for a post: `id`, `title`, `excerpt`, `createdAt` (ISO-8601 string)
  and `author` as an object with the author's `id` and `name`. Including
  `body` (and any other field the pages already get) is fine; extra keys in
  the envelope (e.g. links) are fine too.
- `meta` reports `currentPage`, `lastPage`, `perPage` (10) and `total` for
  the set being listed (the filtered set when a filter is applied).
- Query parameters, both optional:
  - `page` — positive integer, default `1`.
  - `author` — a user id (the same string id the pages expose as a post's
    `author.id`); when present, only that author's posts are listed and
    `meta.total` counts only those. An unknown author, or one with no
    posts, yields an empty `data` and `total: 0` (200, not 404).
  - They combine (`?author=<id>&page=2`).
- Invalid parameters are rejected with a validation error (**400** or
  **422**) and a JSON error body:
  `?page=0` and `?page=abc` are both invalid.
- Responses are `application/json`.

## Front-end requirement: make it part of the typed API surface

Our own front-end will call this endpoint too, through Void's typed fetch
client (`void/client`). The front-end team asks that:

1. The endpoint is a Void server route, so it shows up in the generated
   route types with autocomplete.
2. The response is **typed in the client** — calling the route through the
   typed fetch should give typed data (so `data[0].title` autocompletes).
3. The accepted query parameters (`page`, `author`) are **declared on the
   route itself** as part of its contract (a validator on the handler) — not
   only checked inside the handler body — so the generated types can see
   what the endpoint accepts. Query values arrive as strings, so the declared
   contract must accept `?page=2&author=<id>` and reject the invalid
   examples above.

## Unchanged

- Existing pages and routes (`/posts`, `/posts/:id`, auth, dashboard) keep working exactly as they do now.
- No authentication is added anywhere; the new endpoint is public.
