import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { db } from "@/db";
import { comments } from "@/db/schema";
import { createComment, deleteComment } from "@/lib/actions/comments";
import {
  createPostRow,
  createUser,
  expectRedirect,
  formData,
  logOut,
  loginAs,
  resetDb,
} from "./helpers";

beforeEach(async () => {
  await resetDb();
  logOut();
});

async function createCommentRow(postId: number, authorId: number) {
  const [comment] = await db
    .insert(comments)
    .values({ body: "Nice post!", postId, authorId })
    .returning();
  return comment;
}

describe("commenting", () => {
  test("unauthenticated commenting is rejected with a redirect to /login", async () => {
    const author = await createUser("Alice");
    const post = await createPostRow(author.id);

    await expectRedirect(
      createComment(post.id, {}, formData({ body: "Hi!" })),
      "/login",
    );
    expect(await db.$count(comments)).toBe(0);
  });

  test("a logged-in user can comment on a post", async () => {
    const author = await createUser("Alice");
    const post = await createPostRow(author.id);
    const commenter = await createUser("Bob");
    loginAs(commenter);

    const state = await createComment(
      post.id,
      {},
      formData({ body: "Great read." }),
    );

    expect(state).toEqual({});
    const comment = await db.query.comments.findFirst({
      where: eq(comments.postId, post.id),
    });
    expect(comment!.body).toBe("Great read.");
    expect(comment!.authorId).toBe(commenter.id);
  });

  test("returns validation errors and preserves entered values", async () => {
    const author = await createUser("Alice");
    const post = await createPostRow(author.id);
    loginAs(author);

    const empty = await createComment(post.id, {}, formData({ body: "" }));
    expect(empty.errors?.body?.[0]).toBe("Comment is required.");

    const long = await createComment(
      post.id,
      {},
      formData({ body: "c".repeat(1_001) }),
    );
    expect(long.errors?.body?.[0]).toBe(
      "Comment must be at most 1,000 characters.",
    );
    expect(long.values?.body).toBe("c".repeat(1_001));
    expect(await db.$count(comments)).toBe(0);
  });
});

describe("comment deletion", () => {
  test("the comment author can delete their comment", async () => {
    const postAuthor = await createUser("Alice");
    const post = await createPostRow(postAuthor.id);
    const commenter = await createUser("Bob");
    const comment = await createCommentRow(post.id, commenter.id);
    loginAs(commenter);

    await deleteComment(comment.id);
    expect(await db.$count(comments)).toBe(0);
  });

  test("the post author can delete any comment on their post", async () => {
    const postAuthor = await createUser("Alice");
    const post = await createPostRow(postAuthor.id);
    const commenter = await createUser("Bob");
    const comment = await createCommentRow(post.id, commenter.id);
    loginAs(postAuthor);

    await deleteComment(comment.id);
    expect(await db.$count(comments)).toBe(0);
  });

  test("anyone else cannot delete the comment", async () => {
    const postAuthor = await createUser("Alice");
    const post = await createPostRow(postAuthor.id);
    const commenter = await createUser("Bob");
    const comment = await createCommentRow(post.id, commenter.id);
    const other = await createUser("Mallory");
    loginAs(other);

    await expect(deleteComment(comment.id)).rejects.toThrow(
      "Only the comment author or the post author can delete a comment.",
    );
    expect(await db.$count(comments)).toBe(1);
  });
});
