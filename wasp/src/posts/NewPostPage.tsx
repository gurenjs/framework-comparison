import { useNavigate } from "react-router";
import { createPost } from "wasp/client/operations";
import { PostForm } from "./PostForm";

export function NewPostPage() {
  const navigate = useNavigate();

  return (
    <main>
      <h1>New post</h1>
      <PostForm
        submitLabel="Create"
        onSubmit={async (values) => {
          const post = await createPost(values);
          navigate(`/posts/${post.id}`);
        }}
      />
    </main>
  );
}
