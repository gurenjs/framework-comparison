"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { PostSchema, type FormState } from "@/lib/validation";

async function requireUserId(): Promise<number> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return Number(session.user.id);
}

export async function createPost(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();

  const values = {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  };
  const parsed = PostSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const [post] = await db
    .insert(posts)
    .values({ ...parsed.data, authorId: userId })
    .returning();

  revalidatePath("/");
  redirect(`/posts/${post.id}`);
}

export async function updatePost(
  postId: number,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();

  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post) {
    notFound();
  }
  if (post.authorId !== userId) {
    return { message: "Only the author can edit this post." };
  }

  const values = {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  };
  const parsed = PostSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  await db.update(posts).set(parsed.data).where(eq(posts.id, postId));

  revalidatePath("/");
  revalidatePath(`/posts/${postId}`);
  redirect(`/posts/${postId}`);
}

export async function deletePost(postId: number): Promise<void> {
  const userId = await requireUserId();

  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post) {
    notFound();
  }
  if (post.authorId !== userId) {
    throw new Error("Only the author can delete this post.");
  }

  await db.delete(posts).where(eq(posts.id, postId));

  revalidatePath("/");
  redirect("/");
}
