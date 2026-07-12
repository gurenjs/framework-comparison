import { hash } from "bcryptjs";
import { expect, type Mock } from "vitest";
import { auth } from "@/auth";
import { db } from "@/db";
import { comments, notifications, posts, users } from "@/db/schema";

export const mockedAuth = auth as unknown as Mock;

export function loginAs(user: {
  id: number;
  name: string;
  email: string;
}): void {
  mockedAuth.mockResolvedValue({
    user: { id: String(user.id), name: user.name, email: user.email },
    expires: "",
  });
}

export function logOut(): void {
  mockedAuth.mockResolvedValue(null);
}

export async function resetDb(): Promise<void> {
  await db.delete(comments);
  await db.delete(notifications);
  await db.delete(posts);
  await db.delete(users);
}

let sequence = 0;

export async function createUser(name = "Alice") {
  sequence += 1;
  const [user] = await db
    .insert(users)
    .values({
      name,
      email: `${name.toLowerCase()}-${sequence}@example.com`,
      passwordHash: await hash("password123", 4),
    })
    .returning();
  return user;
}

export async function createPostRow(authorId: number) {
  const [post] = await db
    .insert(posts)
    .values({ title: "Hello world", body: "First post body.", authorId })
    .returning();
  return post;
}

export function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

/** Returns the redirect target if `error` is a Next.js redirect, else null. */
export function redirectTarget(error: unknown): string | null {
  if (error instanceof Error && "digest" in error) {
    const digest = (error as { digest: unknown }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return digest.split(";")[2];
    }
  }
  return null;
}

/** Asserts that an action redirects to `to` (Next.js redirects by throwing). */
export async function expectRedirect(
  promise: Promise<unknown>,
  to: string,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const target = redirectTarget(error);
    if (target === null) {
      throw error;
    }
    expect(target).toBe(to);
    return;
  }
  throw new Error(`Expected a redirect to ${to}, but none was thrown.`);
}
