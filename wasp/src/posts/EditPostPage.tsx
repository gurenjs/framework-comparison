import { useNavigate, useParams } from "react-router";
import { getPost, updatePost, useQuery } from "wasp/client/operations";
import { PostForm } from "./PostForm";

export function EditPostPage() {
  const { id } = useParams();
  const postId = Number(id);
  const navigate = useNavigate();
  const { data: post, isLoading, error } = useQuery(getPost, { id: postId });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p role="alert">{error.message}</p>;
  if (!post) return null;

  return (
    <main>
      <h1>Edit post</h1>
      <PostForm
        initial={{ title: post.title, body: post.body }}
        submitLabel="Save"
        onSubmit={async (values) => {
          await updatePost({ id: postId, ...values });
          navigate(`/posts/${postId}`);
        }}
      />
    </main>
  );
}
