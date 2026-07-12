import { Link } from '@inertiajs/react'
import type { PaginatedPageProps } from '@guren/core'
import type { PostResourceData } from '../../../../app/Http/Resources/PostResource.js'
import { route } from '../../../../.guren/routes.gen'

interface Props extends PaginatedPageProps<PostResourceData> {}

export default function PostsIndex({ data, pagination }: Props) {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Posts</h1>
        <Link href={route('posts.create')} className="rounded bg-black px-4 py-2 text-white">New Post</Link>
      </div>
      <div className="space-y-4">
        {data.map((post) => (
          <article key={post.id} className="rounded border p-4">
            <Link href={route('posts.show', { id: post.id })} className="text-xl font-medium">{post.title}</Link>
            <p className="mt-2 text-sm text-zinc-600">{post.body ?? ''}</p>
          </article>
        ))}
      </div>
      {pagination?.links?.pages && (
        <nav className="flex gap-2">
          {pagination.links.pages.map((page) => (
            <Link key={page.page} href={page.url ?? '#'} className="rounded border px-3 py-1">
              {page.page}
            </Link>
          ))}
        </nav>
      )}
    </main>
  )
}
