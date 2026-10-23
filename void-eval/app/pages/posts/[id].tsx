import { Link, action } from "@void/react";
import type { Props } from "./[id].server";

export default function PostShow({ post, canManage }: Props) {
  async function destroy() {
    if (!confirm("Delete this post?")) return;
    await action("/posts/:id?delete", { params: { id: String(post.id) }, method: "DELETE" });
  }

  return (
    <article>
      <h1>{post.title}</h1>
      <p>
        <small>
          by {post.author.name} · {new Date(post.createdAt).toLocaleDateString()}
        </small>
      </p>
      <p>{post.excerpt}</p>
      <div>{post.body}</div>
      {canManage && (
        <p>
          <Link href={`/posts/${post.id}/edit`}>Edit</Link>{" "}
          <button type="button" onClick={destroy}>Delete</button>
        </p>
      )}
    </article>
  );
}
