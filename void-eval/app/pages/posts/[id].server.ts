import { defineHandler, type InferProps } from "void";
import { getUser, requireAuth } from "void/auth";
import { db, eq } from "void/db";
import { posts } from "@schema";
import { authorizeAuthor, findPostOrFail, parsePostId } from "../../lib/posts";
import { postPayloadSchema } from "../../lib/validators";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const post = await findPostOrFail(parsePostId(c.req.param("id")));
  return { post, canManage: getUser()?.id === post.authorId };
});

export const actions = {
  update: defineHandler.withValidator({
    body: postPayloadSchema,
  })(async (c, { body }) => {
    const user = requireAuth(c);
    const post = await findPostOrFail(parsePostId(c.req.param("id")));
    authorizeAuthor(user, post);
    await db.update(posts).set(body).where(eq(posts.id, post.id));
    return c.redirect(`/posts/${post.id}`);
  }),

  delete: defineHandler(async (c) => {
    const user = requireAuth(c);
    const post = await findPostOrFail(parsePostId(c.req.param("id")));
    authorizeAuthor(user, post);
    await db.delete(posts).where(eq(posts.id, post.id));
    return c.redirect("/posts");
  }),
};
