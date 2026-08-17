import type { Comment, Post, User } from "wasp/entities";
import { HttpError } from "wasp/server";
import type { GetPost, GetPosts } from "wasp/server/operations";
import { requireId } from "../validation";

export const PAGE_SIZE = 10;

type Author = Pick<User, "id" | "name">;

export type PostListItem = Post & { author: Pick<User, "name"> };
export type PostList = {
  posts: PostListItem[];
  page: number;
  totalPages: number;
};
export type PostWithComments = Post & {
  author: Author;
  comments: (Comment & { author: Author })[];
};

type GetPostsArgs = { page?: number };

export const getPosts: GetPosts<GetPostsArgs, PostList> = async (
  { page },
  context,
) => {
  const current = Math.max(1, Number(page) || 1);

  const [posts, total] = await Promise.all([
    context.entities.Post.findMany({
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { author: { select: { name: true } } },
    }),
    context.entities.Post.count(),
  ]);

  return {
    posts,
    page: current,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
};

type GetPostArgs = { id: number };

export const getPost: GetPost<GetPostArgs, PostWithComments> = async (
  { id },
  context,
) => {
  const post = await context.entities.Post.findUnique({
    where: { id: requireId(id, "id") },
    include: {
      author: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });

  // SPEC §2: unknown id is a 404. The client renders a not-found state from it.
  if (!post) {
    throw new HttpError(404, "Post not found");
  }

  return post;
};
