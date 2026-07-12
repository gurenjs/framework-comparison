import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createPost } from "@/lib/actions/posts";
import { PostForm } from "../post-form";

export default async function NewPostPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <h1>New post</h1>
      <PostForm action={createPost} submitLabel="Create post" />
    </>
  );
}
