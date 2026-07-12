"use server";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { after } from "next/server";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { LoginSchema, RegisterSchema, type FormState } from "@/lib/validation";

export async function register(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  const parsed = RegisterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }
  const { name, email, password } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return { errors: { email: ["This email is already registered."] }, values };
  }

  const passwordHash = await hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash })
    .returning();

  // Record the welcome notification outside the response critical path.
  after(async () => {
    await db.insert(notifications).values({
      userId: user.id,
      type: "welcome",
      message: `Welcome to Minilog, ${name}!`,
    });
  });

  await signIn("credentials", { email, password, redirectTo: "/" });
  return {};
}

export async function login(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: "Invalid email or password.", values };
    }
    throw error; // Re-throw the redirect on success.
  }
  return {};
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
