import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { updatePost } from "@/lib/actions/posts";
import { getPost } from "@/lib/data";
import { PostForm } from "../../post-form";

export default async function EditPostPage({
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
  if (!session?.user) {
    redirect("/login");
  }
  // The post is hidden from non-authors; the action rejects them as well.
  if (post.authorId !== Number(session.user.id)) {
    notFound();
  }

  return (
    <>
      <h1>Edit post</h1>
      <PostForm
        action={updatePost.bind(null, post.id)}
        initial={post}
        submitLabel="Save changes"
      />
    </>
  );
}
