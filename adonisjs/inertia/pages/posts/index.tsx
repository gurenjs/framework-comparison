import { urlFor } from '~/client'
import { Link } from '@adonisjs/inertia/react'
import type { InertiaProps } from '~/types'
import type { Data } from '@generated/data'

type PageProps = InertiaProps<{
  posts: {
    data: Data.Post[]
    metadata: {
      total: number
      perPage: number
      currentPage: number
      lastPage: number
      firstPage: number
    }
  }
}>

export default function Index({ posts }: PageProps) {
  const { data, metadata } = posts

  return (
    <>
      <h1>Posts</h1>

      {data.length === 0 ? (
        <p className="meta">No posts yet.</p>
      ) : (
        <ul className="post-list">
          {data.map((post) => (
            <li key={post.id}>
              <Link route="posts.show" routeParams={{ id: post.id }}>
                {post.title}
              </Link>
              <p className="meta">
                by {post.author?.fullName} on{' '}
                {post.createdAt && new Date(post.createdAt).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}

      <nav className="pagination">
        {metadata.currentPage > metadata.firstPage && (
          <Link href={urlFor('posts.index', {}, { qs: { page: metadata.currentPage - 1 } })}>
            ‹ Previous
          </Link>
        )}
        <span className="meta">
          Page {metadata.currentPage} of {metadata.lastPage}
        </span>
        {metadata.currentPage < metadata.lastPage && (
          <Link href={urlFor('posts.index', {}, { qs: { page: metadata.currentPage + 1 } })}>
            Next ›
          </Link>
        )}
      </nav>
    </>
  )
}
