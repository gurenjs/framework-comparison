import { Link, createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import { FieldError } from '../components/FieldError'
import { formatDate } from '../lib/format'
import { addCommentFn, deleteCommentFn } from '../server/comments.functions'
import { deletePostFn, getPostFn } from '../server/posts.functions'
import type { FieldErrors } from '../server/validation'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const id = Number(params.postId)
    const post =
      Number.isInteger(id) && id > 0 ? await getPostFn({ data: { id } }) : null
    if (!post) throw notFound()
    return post
  },
  notFoundComponent: () => <p>Post not found.</p>,
  component: PostShowPage,
})

function PostShowPage() {
  const post = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const deletePost = useServerFn(deletePostFn)
  const deleteComment = useServerFn(deleteCommentFn)
  const isPostAuthor = user?.id === post.author.id

  return (
    <article>
      <h1>{post.title}</h1>
      <p className="meta">
        by {post.author.name} on {formatDate(post.createdAt)}
      </p>
      {isPostAuthor && (
        <p>
          <Link to="/posts/$postId/edit" params={{ postId: String(post.id) }}>
            Edit
          </Link>{' '}
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Delete this post?')) return
              await deletePost({ data: { id: post.id } })
            }}
          >
            Delete
          </button>
        </p>
      )}
      <div className="post-body">{post.body}</div>

      <h2>Comments</h2>
      {post.comments.length === 0 ? (
        <p>No comments yet.</p>
      ) : (
        <ul className="comments">
          {post.comments.map((comment) => (
            <li key={comment.id}>
              <p className="meta">
                {comment.author.name} on {formatDate(comment.createdAt)}
              </p>
              <p>{comment.body}</p>
              {(user?.id === comment.author.id || isPostAuthor) && (
                <button
                  type="button"
                  onClick={async () => {
                    await deleteComment({ data: { id: comment.id } })
                    await router.invalidate()
                  }}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {user ? (
        <CommentForm postId={post.id} />
      ) : (
        <p>
          <Link to="/login">Log in</Link> to comment.
        </p>
      )}
    </article>
  )
}

function CommentForm({ postId }: { postId: number }) {
  const router = useRouter()
  const addComment = useServerFn(addCommentFn)
  const [body, setBody] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        const result = await addComment({ data: { postId, body } })
        if (result?.errors) {
          setErrors(result.errors)
          return
        }
        setBody('')
        setErrors({})
        await router.invalidate()
      }}
    >
      <label>
        Add a comment
        <textarea
          name="body"
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <FieldError messages={errors.body} />
      <button type="submit">Comment</button>
    </form>
  )
}
