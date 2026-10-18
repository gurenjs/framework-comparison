import { defineHandler, type InferProps } from "void";
import { authorizeAuthor, findPostOrFail, parsePostId } from "../../../lib/posts";
import { userOrRedirect } from "../../../lib/guards";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const user = userOrRedirect(c);
  if (user instanceof Response) return user;
  const post = await findPostOrFail(parsePostId(c.req.param("id")));
  authorizeAuthor(user, post);
  return { post };
});
