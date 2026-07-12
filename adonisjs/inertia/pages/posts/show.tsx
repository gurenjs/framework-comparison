import { Form, Link } from '@adonisjs/inertia/react'
import type { InertiaProps } from '~/types'
import type { Data } from '@generated/data'

type PageProps = InertiaProps<{
  post: Data.Post
}>

export default function Show({ post, user }: PageProps) {
  const isPostAuthor = user?.id === post.userId

  return (
    <article>
      <h1>{post.title}</h1>
      <p className="meta">
        by {post.author?.fullName} on{' '}
        {post.createdAt && new Date(post.createdAt).toLocaleDateString()}
      </p>

      <div className="post-body">{post.body}</div>

      {isPostAuthor && (
        <div className="actions">
          <Link route="posts.edit" routeParams={{ id: post.id }}>
            Edit
          </Link>
          <Form route="posts.destroy" routeParams={{ id: post.id }}>
            <button type="submit">Delete</button>
          </Form>
        </div>
      )}

      <section>
        <h2>Comments</h2>

        {post.comments?.length === 0 && <p className="meta">No comments yet.</p>}

        <ul className="comments">
          {post.comments?.map((comment) => (
            <li key={comment.id}>
              <p>{comment.body}</p>
              <div className="actions">
                <span className="meta">
                  by {comment.author?.fullName} on{' '}
                  {comment.createdAt && new Date(comment.createdAt).toLocaleDateString()}
                </span>
                {(user?.id === comment.userId || isPostAuthor) && (
                  <Form route="comments.destroy" routeParams={{ id: comment.id }}>
                    <button type="submit">Delete</button>
                  </Form>
                )}
              </div>
            </li>
          ))}
        </ul>

        {user ? (
          <Form route="comments.store" routeParams={{ postId: post.id }} resetOnSuccess>
            {({ errors }) => (
              <div>
                <label htmlFor="body">Add a comment</label>
                <textarea
                  name="body"
                  id="body"
                  rows={3}
                  data-invalid={errors.body ? 'true' : undefined}
                />
                {errors.body && <div>{errors.body}</div>}
                <button type="submit">Comment</button>
              </div>
            )}
          </Form>
        ) : (
          <p className="meta">
            <Link route="session.create">Login</Link> to add a comment.
          </p>
        )}
      </section>
    </article>
  )
}
