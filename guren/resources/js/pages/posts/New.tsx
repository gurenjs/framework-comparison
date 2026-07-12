import { Head, useForm } from '@inertiajs/react'
import Layout from '../../components/Layout.js'
import type { ApiRoutes } from '../../../../.guren/api-client.gen'
import { route } from '../../../../.guren/routes.gen'

type PostFormData = ApiRoutes['posts.store']['body']

export default function NewPost() {
  const form = useForm<PostFormData>({ title: '', body: '' })

  return (
    <Layout>
      <Head title="New post" />
      <h1>New post</h1>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          form.post(route('posts.store'))
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
          Create
        </button>
      </form>
    </Layout>
  )
}
