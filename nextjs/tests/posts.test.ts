import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { createPost, deletePost, updatePost } from "@/lib/actions/posts";
import {
  createPostRow,
  createUser,
  expectRedirect,
  formData,
  logOut,
  loginAs,
  redirectTarget,
  resetDb,
} from "./helpers";

beforeEach(async () => {
  await resetDb();
  logOut();
});

describe("post creation", () => {
  test("unauthenticated creation is rejected with a redirect to /login", async () => {
    await expectRedirect(
      createPost({}, formData({ title: "Hello", body: "World" })),
      "/login",
    );
    expect(await db.$count(posts)).toBe(0);
  });

  test("a logged-in user can create a post", async () => {
    const user = await createUser("Alice");
    loginAs(user);

    let redirectedTo: string | null = null;
    try {
      await createPost({}, formData({ title: "Hello", body: "World" }));
    } catch (error) {
      redirectedTo = redirectTarget(error);
      if (redirectedTo === null) {
        throw error;
      }
    }

    const post = await db.query.posts.findFirst({
      where: eq(posts.title, "Hello"),
    });
    expect(post).toBeDefined();
    expect(post!.body).toBe("World");
    expect(post!.authorId).toBe(user.id);
    expect(redirectedTo).toBe(`/posts/${post!.id}`);
  });

  test("returns per-field validation errors and preserves entered values", async () => {
    const user = await createUser("Alice");
    loginAs(user);

    const state = await createPost(
      {},
      formData({ title: "", body: "b".repeat(10_001) }),
    );

    expect(state.errors?.title?.[0]).toBe("Title is required.");
    expect(state.errors?.body?.[0]).toBe(
      "Body must be at most 10,000 characters.",
    );
    expect(state.values?.body).toBe("b".repeat(10_001));
    expect(await db.$count(posts)).toBe(0);
  });

  test("rejects a title longer than 120 characters", async () => {
    const user = await createUser("Alice");
    loginAs(user);

    const state = await createPost(
      {},
      formData({ title: "t".repeat(121), body: "Fine body." }),
    );
    expect(state.errors?.title?.[0]).toBe(
      "Title must be at most 120 characters.",
    );
  });
});

describe("post update and delete", () => {
  test("the author can update their post", async () => {
    const author = await createUser("Alice");
    const post = await createPostRow(author.id);
    loginAs(author);

    await expectRedirect(
      updatePost(
        post.id,
        {},
        formData({ title: "Updated title", body: "Updated body." }),
      ),
      `/posts/${post.id}`,
    );

    const updated = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });
    expect(updated!.title).toBe("Updated title");
    expect(updated!.body).toBe("Updated body.");
  });

  test("a non-author cannot update someone else's post", async () => {
    const author = await createUser("Alice");
    const post = await createPostRow(author.id);
    const other = await createUser("Mallory");
    loginAs(other);

    const state = await updatePost(
      post.id,
      {},
      formData({ title: "Hijacked", body: "Nope." }),
    );

    expect(state.message).toBe("Only the author can edit this post.");
    const unchanged = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
    });
    expect(unchanged!.title).toBe(post.title);
  });

  test("update returns validation errors for invalid input", async () => {
    const author = await createUser("Alice");
    const post = await createPostRow(author.id);
    loginAs(author);

    const state = await updatePost(
      post.id,
      {},
      formData({ title: "", body: "" }),
    );
    expect(state.errors?.title?.[0]).toBe("Title is required.");
    expect(state.errors?.body?.[0]).toBe("Body is required.");
  });

  test("the author can delete their post", async () => {
    const author = await createUser("Alice");
    const post = await createPostRow(author.id);
    loginAs(author);

    await expectRedirect(deletePost(post.id), "/");
    expect(await db.$count(posts)).toBe(0);
  });

  test("a non-author cannot delete someone else's post", async () => {
    const author = await createUser("Alice");
    const post = await createPostRow(author.id);
    const other = await createUser("Mallory");
    loginAs(other);

    await expect(deletePost(post.id)).rejects.toThrow(
      "Only the author can delete this post.",
    );
    expect(await db.$count(posts)).toBe(1);
  });

  test("updating a missing post is a 404", async () => {
    const user = await createUser("Alice");
    loginAs(user);

    await expect(
      updatePost(999_999, {}, formData({ title: "T", body: "B" })),
    ).rejects.toThrowError(
      expect.objectContaining({ digest: expect.stringContaining("404") }),
    );
  });
});
