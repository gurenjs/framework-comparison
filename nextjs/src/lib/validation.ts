import { z } from "zod";

export const RegisterSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required.")
    .max(50, "Name must be at most 50 characters."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const LoginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const PostSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required.")
    .max(120, "Title must be at most 120 characters."),
  body: z
    .string()
    .min(1, "Body is required.")
    .max(10_000, "Body must be at most 10,000 characters."),
});

export const CommentSchema = z.object({
  body: z
    .string()
    .min(1, "Comment is required.")
    .max(1_000, "Comment must be at most 1,000 characters."),
});

/** State returned by form Server Actions and consumed by `useActionState`. */
export type FormState = {
  /** Per-field validation messages, keyed by input name. */
  errors?: Record<string, string[] | undefined>;
  /** Submitted values, echoed back so the form can preserve user input. */
  values?: Record<string, string>;
  /** Form-level error message. */
  message?: string;
};
