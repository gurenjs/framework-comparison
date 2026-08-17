import type { Comment, Post } from "wasp/entities";
import { HttpError } from "wasp/server";
import type {
  CreateComment,
  CreatePost,
  DeleteComment,
  DeletePost,
  UpdatePost,
} from "wasp/server/operations";
import { requireId, requireLength } from "../validation";

function requireUser(context: { user?: { id: number } }): { id: number } {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.user;
}

type PostArgs = { title: string; body: string };

export const createPost: CreatePost<PostArgs, Post> = async (args, context) => {
  const user = requireUser(context);
  const title = requireLength(args.title, "title", 1, 120, "Title");
  const body = requireLength(args.body, "body", 1, 10_000, "Body");

  return context.entities.Post.create({
    data: { title, body, author: { connect: { id: user.id } } },
  });
};

export const updatePost: UpdatePost<PostArgs & { id: number }, Post> = async (
  args,
  context,
) => {
  const user = requireUser(context);
  const id = requireId(args.id, "id");
  const title = requireLength(args.title, "title", 1, 120, "Title");
  const body = requireLength(args.body, "body", 1, 10_000, "Body");

  const post = await context.entities.Post.findUnique({ where: { id } });
  if (!post) {
    throw new HttpError(404, "Post not found");
  }
  // SPEC §2: only the author may edit or delete.
  if (post.authorId !== user.id) {
    throw new HttpError(403, "You can only edit your own posts");
  }

  return context.entities.Post.update({ where: { id }, data: { title, body } });
};

export const deletePost: DeletePost<{ id: number }, Post> = async (
  args,
  context,
) => {
  const user = requireUser(context);
  const id = requireId(args.id, "id");

  const post = await context.entities.Post.findUnique({ where: { id } });
  if (!post) {
    throw new HttpError(404, "Post not found");
  }
  if (post.authorId !== user.id) {
    throw new HttpError(403, "You can only delete your own posts");
  }

  return context.entities.Post.delete({ where: { id } });
};

type CommentArgs = { postId: number; body: string };

export const createComment: CreateComment<CommentArgs, Comment> = async (
  args,
  context,
) => {
  const user = requireUser(context);
  const postId = requireId(args.postId, "postId");
  const body = requireLength(args.body, "body", 1, 1_000, "Comment");

  const post = await context.entities.Post.findUnique({ where: { id: postId } });
  if (!post) {
    throw new HttpError(404, "Post not found");
  }

  return context.entities.Comment.create({
    data: {
      body,
      author: { connect: { id: user.id } },
      post: { connect: { id: postId } },
    },
  });
};

export const deleteComment: DeleteComment<{ id: number }, Comment> = async (
  args,
  context,
) => {
  const user = requireUser(context);
  const id = requireId(args.id, "id");

  const comment = await context.entities.Comment.findUnique({
    where: { id },
    include: { post: { select: { authorId: true } } },
  });
  if (!comment) {
    throw new HttpError(404, "Comment not found");
  }
  // SPEC §3: the comment's author or the post's author may delete it.
  if (comment.authorId !== user.id && comment.post.authorId !== user.id) {
    throw new HttpError(403, "You cannot delete this comment");
  }

  return context.entities.Comment.delete({ where: { id } });
};
