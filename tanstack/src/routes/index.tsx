import { Link, createFileRoute } from '@tanstack/react-router'

import { formatDate } from '../lib/format'
import { listPostsFn } from '../server/posts.functions'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { page?: number } => ({
    page: search.page ? Math.max(1, Math.trunc(Number(search.page)) || 1) : undefined,
  }),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: ({ deps }) => listPostsFn({ data: { page: deps.page } }),
  component: PostsIndex,
})

function PostsIndex() {
  const { items, page, pageCount } = Route.useLoaderData()

  return (
    <>
      <h1>Posts</h1>
      {items.length === 0 ? (
        <p>No posts yet.</p>
      ) : (
        <ul className="post-list">
          {items.map((post) => (
            <li key={post.id}>
              <Link to="/posts/$postId" params={{ postId: String(post.id) }}>
                {post.title}
              </Link>
              <span className="meta">
                by {post.authorName} on {formatDate(post.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <nav className="pagination">
        {page > 1 && (
          <Link to="/" search={{ page: page - 1 }}>
            ← Newer
          </Link>
        )}
        <span className="meta">
          Page {page} of {pageCount}
        </span>
        {page < pageCount && (
          <Link to="/" search={{ page: page + 1 }}>
            Older →
          </Link>
        )}
      </nav>
    </>
  )
}
