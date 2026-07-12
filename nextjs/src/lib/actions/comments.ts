"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { comments, posts } from "@/db/schema";
import { CommentSchema, type FormState } from "@/lib/validation";

async function requireUserId(): Promise<number> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return Number(session.user.id);
}

export async function createComment(
  postId: number,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();

  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post) {
    notFound();
  }

  const values = { body: String(formData.get("body") ?? "") };
  const parsed = CommentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  await db
    .insert(comments)
    .values({ body: parsed.data.body, postId, authorId: userId });

  revalidatePath(`/posts/${postId}`);
  return {};
}

export async function deleteComment(commentId: number): Promise<void> {
  const userId = await requireUserId();

  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
    with: { post: { columns: { authorId: true } } },
  });
  if (!comment) {
    notFound();
  }
  if (comment.authorId !== userId && comment.post.authorId !== userId) {
    throw new Error(
      "Only the comment author or the post author can delete a comment.",
    );
  }

  await db.delete(comments).where(eq(comments.id, commentId));

  revalidatePath(`/posts/${comment.postId}`);
}
