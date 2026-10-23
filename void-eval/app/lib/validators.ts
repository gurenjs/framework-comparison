import { z } from "zod";

export const postPayloadSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(255, "Title must be 255 characters or fewer."),
  excerpt: z.string().trim().min(1, "Excerpt is required.").max(500, "Excerpt must be 500 characters or fewer."),
  body: z.string().trim().min(1, "Body is required."),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120, "Name must be 120 characters or fewer."),
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
});

export const listPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().optional(),
});

export const postIdSchema = z.coerce.number().int().positive();
