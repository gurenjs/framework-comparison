import { Link } from '@inertiajs/react'
import type { PostResourceData } from '../../../../app/Http/Resources/PostResource.js'
import { route } from '../../../../.guren/routes.gen'

interface Props {
  post: PostResourceData
}

export default function PostShow({ post }: Props) {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <Link href={route('posts.index')}>Back</Link>
      <p><strong>title:</strong> {post.title}</p>
      <p><strong>body:</strong> {post.body}</p>
      <Link href={route('posts.edit', { id: post.id })}>Edit</Link>
    </main>
  )
}
