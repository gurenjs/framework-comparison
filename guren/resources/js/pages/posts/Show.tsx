import { Head, Link, useForm, usePage } from '@inertiajs/react'
import Layout from '../../components/Layout.js'
import type { PostResourceData } from '../../../../app/Http/Resources/PostResource.js'
import { route } from '../../../../.guren/routes.gen'

interface CommentData {
  id: number
  body: string
  userId: number
  author: { name: string } | null
  createdAt: string
}

interface Props {
  post: PostResourceData
  comments: CommentData[]
  errors?: { body?: string }
}

export default function PostShow({ post, comments, errors = {} }: Props) {
  const { props } = usePage<{ auth?: { user?: { id?: number } } }>()
  const userId = props.auth?.user?.id
  const form = useForm({ body: '' })

  return (
    <Layout>
      <Head title={post.title} />
      <Link href={route('posts.index')}>← All posts</Link>
      <h1>{post.title}</h1>
      <p className="meta">
        by {post.author?.name ?? 'Unknown'} · {new Date(post.createdAt).toLocaleDateString()}
      </p>
      <p>{post.body}</p>

      {userId === post.userId && (
        <p>
          <Link href={route('posts.edit', { id: post.id })}>Edit</Link>{' '}
          <Link href={route('posts.destroy', { id: post.id })} method="delete" as="button" className="link">
            Delete
          </Link>
        </p>
      )}

      <h2>Comments</h2>
      <ul className="comments">
        {comments.map((comment) => (
          <li key={comment.id}>
            <p className="meta">{comment.author?.name ?? 'Unknown'}</p>
            <p>{comment.body}</p>
            {(userId === comment.userId || userId === post.userId) && (
              <Link
                href={route('comments.destroy', { id: post.id, commentId: comment.id })}
                method="delete"
                as="button"
                className="link"
              >
                Delete
              </Link>
            )}
          </li>
        ))}
      </ul>

      {userId ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault()
            form.post(route('comments.store', { id: post.id }), { onSuccess: () => form.reset() })
          }}
        >
          <label>
            Add a comment
            <textarea value={form.data.body} onChange={(event) => form.setData('body', event.target.value)} />
            {(form.errors.body ?? errors.body) && <span className="error">{form.errors.body ?? errors.body}</span>}
          </label>
          <button type="submit" disabled={form.processing}>
            Comment
          </button>
        </form>
      ) : (
        <p className="meta">
          <Link href="/login">Log in</Link> to comment.
        </p>
      )}
    </Layout>
  )
}
