import { defineHandler, type InferProps } from "void";
import { requireAuth } from "void/auth";
import { count, db, desc, like, or } from "void/db";
import { posts } from "@schema";
import { selectPosts } from "../../lib/posts";
import { paginationMeta } from "../../lib/pagination";
import { listPostsQuerySchema, postPayloadSchema } from "../../lib/validators";

const PER_PAGE = 10;

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const parsed = listPostsQuerySchema.safeParse(c.req.query());
  const { page, q } = parsed.success ? parsed.data : { page: 1, q: undefined };
  const keywords = (q ?? "").split(/\s+/).filter((k) => k.length > 0);
  // Any keyword in the title or excerpt matches.
  const search = keywords.length
    ? or(...keywords.flatMap((k) => [like(posts.title, `%${k}%`), like(posts.excerpt, `%${k}%`)]))
    : undefined;

  const [{ total }] = await db.select({ total: count() }).from(posts).where(search);
  const data = await selectPosts()
    .where(search)
    .orderBy(desc(posts.id))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE);

  return {
    data,
    q: q ?? "",
    pagination: { meta: paginationMeta(page, PER_PAGE, total, data.length) },
  };
});

export const action = defineHandler.withValidator({
  body: postPayloadSchema,
})(async (c, { body }) => {
  const user = requireAuth(c);
  const [post] = await db
    .insert(posts)
    .values({ ...body, authorId: user.id })
    .returning({ id: posts.id });
  return c.redirect(`/posts/${post.id}`);
});
