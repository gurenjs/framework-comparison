import { useForm } from '@inertiajs/react'
import type { ApiRoutes } from '../../../../.guren/api-client.gen'
import type { RouteErrors } from '@guren/inertia-client/typed-forms'
import { route } from '../../../../.guren/routes.gen'

type PostFormData = ApiRoutes['posts.store']['body']

interface Props {
  post: PostFormData & { id: number }
  errors?: RouteErrors<PostFormData> & { message?: string }
}

export default function EditPost({ post }: Props) {
  const form = useForm<PostFormData>({ title: post.title, body: post.body })
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); form.put(route('posts.update', { id: post.id })) }}>
        <input value={form.data.title} onChange={(event) => form.setData('title', event.target.value)} placeholder="title" className="w-full rounded border px-3 py-2" />
        <textarea value={form.data.body} onChange={(event) => form.setData('body', event.target.value)} placeholder="body" className="w-full rounded border px-3 py-2" />
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">Save</button>
      </form>
    </main>
  )
}
