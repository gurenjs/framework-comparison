import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api'
import type { Pagination, PostSummary } from '../types'

export function PostList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)

  useEffect(() => {
    api
      .get<{ posts: PostSummary[]; pagination: Pagination }>(`/api/posts?page=${page}`)
      .then((data) => {
        setPosts(data.posts)
        setPagination(data.pagination)
      })
      .catch(() => setPosts([]))
  }, [page])

  return (
    <div>
      <h1>Posts</h1>
      {posts.length === 0 && <p>No posts yet.</p>}
      <ul className="post-list">
        {posts.map((post) => (
          <li key={post.id}>
            <Link to={`/posts/${post.id}`}>{post.title}</Link>
            <span className="meta">
              by {post.author.name} on {new Date(post.createdAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
      {pagination && pagination.totalPages > 1 && (
        <nav className="pagination">
          <button disabled={page <= 1} onClick={() => setSearchParams({ page: String(page - 1) })}>
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={page >= pagination.totalPages}
            onClick={() => setSearchParams({ page: String(page + 1) })}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  )
}
