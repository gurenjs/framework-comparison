import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { deleteComment } from "@/lib/actions/comments";
import { deletePost } from "@/lib/actions/posts";
import { getPost } from "@/lib/data";
import { CommentForm } from "./comment-form";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    notFound();
  }

  const [session, post] = await Promise.all([auth(), getPost(postId)]);
  if (!post) {
    notFound();
  }
  const userId = session?.user ? Number(session.user.id) : null;

  return (
    <article>
      <h1>{post.title}</h1>
      <p className="muted">
        by {post.author.name} on {post.createdAt.toLocaleDateString()}
      </p>
      <p className="post-body">{post.body}</p>

      {userId === post.authorId && (
        <div className="actions">
          <Link href={`/posts/${post.id}/edit`}>Edit</Link>
          <form action={deletePost.bind(null, post.id)}>
            <button type="submit">Delete</button>
          </form>
        </div>
      )}

      <section>
        <h2>Comments ({post.comments.length})</h2>
        {post.comments.map((comment) => (
          <div key={comment.id} className="comment">
            <p className="comment-body">{comment.body}</p>
            <p className="muted">
              {comment.author.name} on {comment.createdAt.toLocaleDateString()}
            </p>
            {userId !== null &&
              (userId === comment.authorId || userId === post.authorId) && (
                <form action={deleteComment.bind(null, comment.id)}>
                  <button type="submit">Delete comment</button>
                </form>
              )}
          </div>
        ))}
        {session?.user ? (
          <CommentForm postId={post.id} />
        ) : (
          <p className="muted">
            <Link href="/login">Log in</Link> to comment.
          </p>
        )}
      </section>
    </article>
  );
}
