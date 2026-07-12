import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { FieldError } from '../components/FieldError'
import type { FieldErrors, PostDetail } from '../types'

export function PostShow() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [post, setPost] = useState<PostDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  const load = useCallback(() => {
    api
      .get<{ post: PostDetail }>(`/api/posts/${id}`)
      .then(({ post }) => setPost(post))
      .catch(() => setNotFound(true))
  }, [id])

  useEffect(load, [load])

  async function handleDeletePost() {
    await api.delete(`/api/posts/${id}`)
    navigate('/')
  }

  async function handleComment(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    try {
      await api.post(`/api/posts/${id}/comments`, { body: commentBody })
      setCommentBody('')
      load()
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fieldErrors)
    }
  }

  async function handleDeleteComment(commentId: number) {
    await api.delete(`/api/comments/${commentId}`)
    load()
  }

  if (notFound) return <p>Post not found.</p>
  if (!post) return <p>Loading…</p>

  const isAuthor = user?.id === post.author.id

  return (
    <article>
      <h1>{post.title}</h1>
      <p className="meta">
        by {post.author.name} on {new Date(post.createdAt).toLocaleDateString()}
      </p>
      <p className="post-body">{post.body}</p>
      {isAuthor && (
        <p className="actions">
          <Link to={`/posts/${post.id}/edit`}>Edit</Link>{' '}
          <button onClick={handleDeletePost}>Delete</button>
        </p>
      )}

      <section>
        <h2>Comments</h2>
        {post.comments.length === 0 && <p>No comments yet.</p>}
        <ul className="comments">
          {post.comments.map((comment) => (
            <li key={comment.id}>
              <p>{comment.body}</p>
              <span className="meta">by {comment.author.name}</span>
              {user && (user.id === comment.author.id || isAuthor) && (
                <button onClick={() => handleDeleteComment(comment.id)}>Delete</button>
              )}
            </li>
          ))}
        </ul>
        {user ? (
          <form onSubmit={handleComment}>
            <label>
              Add a comment
              <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} />
            </label>
            <FieldError messages={errors.body} />
            <button type="submit">Comment</button>
          </form>
        ) : (
          <p>
            <Link to="/login">Log in</Link> to comment.
          </p>
        )}
      </section>
    </article>
  )
}
