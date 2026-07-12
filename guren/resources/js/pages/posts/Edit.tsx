import { Head, useForm } from '@inertiajs/react'
import Layout from '../../components/Layout.js'
import type { ApiRoutes } from '../../../../.guren/api-client.gen'
import { route } from '../../../../.guren/routes.gen'

type PostFormData = ApiRoutes['posts.update']['body']

interface Props {
  post: PostFormData & { id: number }
}

export default function EditPost({ post }: Props) {
  const form = useForm<PostFormData>({ title: post.title, body: post.body })

  return (
    <Layout>
      <Head title="Edit post" />
      <h1>Edit post</h1>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          form.put(route('posts.update', { id: post.id }))
        }}
      >
        <label>
          Title
          <input value={form.data.title} onChange={(event) => form.setData('title', event.target.value)} />
          {form.errors.title && <span className="error">{form.errors.title}</span>}
        </label>
        <label>
          Body
          <textarea rows={8} value={form.data.body} onChange={(event) => form.setData('body', event.target.value)} />
          {form.errors.body && <span className="error">{form.errors.body}</span>}
        </label>
        <button type="submit" disabled={form.processing}>
          Save
        </button>
      </form>
    </Layout>
  )
}
