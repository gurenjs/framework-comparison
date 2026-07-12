import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts, users } from "@/db/schema";

export const POSTS_PER_PAGE = 10;

export async function getPostsPage(page: number) {
  const [rows, total] = await Promise.all([
    db.query.posts.findMany({
      with: { author: { columns: { name: true } } },
      orderBy: (posts, { desc }) => [desc(posts.createdAt), desc(posts.id)],
      limit: POSTS_PER_PAGE,
      offset: (page - 1) * POSTS_PER_PAGE,
    }),
    db.$count(posts),
  ]);
  return {
    posts: rows,
    totalPages: Math.max(1, Math.ceil(total / POSTS_PER_PAGE)),
  };
}

export async function getPost(id: number) {
  return db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: {
      author: { columns: { name: true } },
      comments: {
        with: { author: { columns: { name: true } } },
        orderBy: (comments, { asc }) => [asc(comments.createdAt), asc(comments.id)],
      },
    },
  });
}

/** Returns the user when the email/password pair is valid, `null` otherwise. */
export async function verifyCredentials(email: string, password: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (!user) {
    return null;
  }
  const valid = await compare(password, user.passwordHash);
  return valid ? user : null;
}
