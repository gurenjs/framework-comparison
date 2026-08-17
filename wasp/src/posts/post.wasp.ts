import { type Spec, action, page, query, route } from "@wasp.sh/spec";
import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  updatePost,
} from "./actions" with { type: "ref" };
import { EditPostPage } from "./EditPostPage" with { type: "ref" };
import { NewPostPage } from "./NewPostPage" with { type: "ref" };
import { PostListPage } from "./PostListPage" with { type: "ref" };
import { PostPage } from "./PostPage" with { type: "ref" };
import { getPost, getPosts } from "./queries" with { type: "ref" };

export const postsSpec: Spec = [
  route("PostListRoute", "/", page(PostListPage)),
  route("NewPostRoute", "/posts/new", page(NewPostPage, { authRequired: true })),
  route(
    "EditPostRoute",
    "/posts/:id/edit",
    page(EditPostPage, { authRequired: true }),
  ),
  route("PostRoute", "/posts/:id", page(PostPage)),

  query(getPosts, { entities: ["Post"] }),
  query(getPost, { entities: ["Post", "Comment"] }),

  action(createPost, { entities: ["Post"] }),
  action(updatePost, { entities: ["Post"] }),
  action(deletePost, { entities: ["Post"] }),
  action(createComment, { entities: ["Post", "Comment"] }),
  action(deleteComment, { entities: ["Post", "Comment"] }),
];
