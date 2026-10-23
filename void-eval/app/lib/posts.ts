import { HTTPException } from "hono/http-exception";
import { posts } from "@schema";
import { db, eq } from "void/db";
import type { AuthUser } from "void/auth";
import { users } from "./users";
import { postIdSchema } from "./validators";

const postColumns = {
  id: posts.id,
  title: posts.title,
  excerpt: posts.excerpt,
  body: posts.body,
  authorId: posts.authorId,
  createdAt: posts.createdAt,
  author: { id: users.id, name: users.name },
};

export function selectPosts() {
  return db.select(postColumns).from(posts).innerJoin(users, eq(users.id, posts.authorId));
}

export type PostWithAuthor = Awaited<ReturnType<typeof selectPosts>>[number];

/** Parses the `[id]` route param; anything that is not a positive integer is a 404. */
export function parsePostId(raw: string | undefined): number {
  const parsed = postIdSchema.safeParse(raw);
  if (!parsed.success) throw new HTTPException(404, { message: "Post not found" });
  return parsed.data;
}

export async function findPostOrFail(id: number): Promise<PostWithAuthor> {
  const [post] = await selectPosts().where(eq(posts.id, id));
  if (!post) throw new HTTPException(404, { message: "Post not found" });
  return post;
}

/** Only a post's author may edit or delete it. */
export function authorizeAuthor(user: AuthUser, post: { authorId: string }): void {
  if (post.authorId !== user.id) throw new HTTPException(403, { message: "Forbidden" });
}
