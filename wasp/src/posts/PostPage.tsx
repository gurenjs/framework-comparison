import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "wasp/client/auth";
import {
  createComment,
  deleteComment,
  deletePost,
  getPost,
  useQuery,
} from "wasp/client/operations";
import { type FieldErrors, fieldErrorsOf } from "../validation";

export function PostPage() {
  const { id } = useParams();
  const postId = Number(id);
  const navigate = useNavigate();
  const { data: user } = useAuth();
  const { data: post, isLoading, error, refetch } = useQuery(getPost, {
    id: postId,
  });
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  if (isLoading) return <p>Loading…</p>;
  // SPEC §2: an unknown id is a 404 from the query, rendered as not-found.
  if (error) return <p role="alert">{error.message}</p>;
  if (!post) return null;

  const isAuthor = user?.id === post.author.id;

  return (
    <main>
      <h1>{post.title}</h1>
      <p>by {post.author.name}</p>
      <p>{post.body}</p>

      {isAuthor && (
        <p>
          <Link to={`/posts/${post.id}/edit`}>Edit</Link>{" "}
          <button
            type="button"
            onClick={async () => {
              await deletePost({ id: post.id });
              navigate("/");
            }}
          >
            Delete
          </button>
        </p>
      )}

      <h2>Comments</h2>
      <ul>
        {post.comments.map((comment) => (
          <li key={comment.id}>
            <span>
              {comment.author.name}: {comment.body}
            </span>
            {/* SPEC §3: the comment's author or the post's author may delete. */}
            {(user?.id === comment.author.id || isAuthor) && (
              <button
                type="button"
                onClick={async () => {
                  await deleteComment({ id: comment.id });
                  await refetch();
                }}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      {user ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setErrors({});
            try {
              await createComment({ postId: post.id, body });
              setBody("");
              await refetch();
            } catch (submitError) {
              setErrors(fieldErrorsOf(submitError));
            }
          }}
        >
          <label htmlFor="comment">Add a comment</label>
          <textarea
            id="comment"
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          {errors.body && <p role="alert">{errors.body}</p>}
          <button type="submit">Comment</button>
        </form>
      ) : (
        <p>
          <Link to="/login">Log in</Link> to comment.
        </p>
      )}
    </main>
  );
}
