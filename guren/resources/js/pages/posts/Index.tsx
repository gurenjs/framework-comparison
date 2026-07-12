import { Head, Link } from '@inertiajs/react'
import type { PaginatedPageProps } from '@guren/core'
import Layout from '../../components/Layout.js'
import type { PostResourceData } from '../../../../app/Http/Resources/PostResource.js'
import { route } from '../../../../.guren/routes.gen'

interface Props extends PaginatedPageProps<PostResourceData> {}

export default function PostsIndex({ data, pagination }: Props) {
  return (
    <Layout>
      <Head title="Posts" />
      <h1>Posts</h1>
      {data.map((post) => (
        <article key={post.id} className="post">
          <h2>
            <Link href={route('posts.show', { id: post.id })}>{post.title}</Link>
          </h2>
          <p className="meta">
            by {post.author?.name ?? 'Unknown'} · {new Date(post.createdAt).toLocaleDateString()}
          </p>
        </article>
      ))}
      {pagination.links.pages.length > 1 && (
        <nav className="pagination">
          {pagination.links.pages.map((page) => (
            <Link key={page.page} href={page.url ?? '#'}>
              {page.active ? <strong>{page.page}</strong> : page.page}
            </Link>
          ))}
        </nav>
      )}
    </Layout>
  )
}
