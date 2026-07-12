import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { beforeEach, describe, expect, test, type Mock } from "vitest";
import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { login, logout, register } from "@/lib/actions/auth";
import { verifyCredentials } from "@/lib/data";
import { flushAfter } from "./after-queue";
import { formData, resetDb } from "./helpers";

const mockedSignIn = signIn as unknown as Mock;

beforeEach(async () => {
  await resetDb();
  mockedSignIn.mockReset();
});

describe("register → login → logout", () => {
  test("register creates the user with a hashed password and signs them in", async () => {
    const state = await register(
      {},
      formData({
        name: "Alice",
        email: "alice@example.com",
        password: "password123",
      }),
    );

    expect(state).toEqual({});
    const user = await db.query.users.findFirst({
      where: eq(users.email, "alice@example.com"),
    });
    expect(user).toBeDefined();
    expect(user!.name).toBe("Alice");
    expect(user!.passwordHash).not.toContain("password123");
    expect(mockedSignIn).toHaveBeenCalledWith("credentials", {
      email: "alice@example.com",
      password: "password123",
      redirectTo: "/",
    });
  });

  test("register records a welcome notification via deferred work", async () => {
    await register(
      {},
      formData({
        name: "Bob",
        email: "bob@example.com",
        password: "password123",
      }),
    );
    await flushAfter();

    const user = await db.query.users.findFirst({
      where: eq(users.email, "bob@example.com"),
    });
    const rows = await db.query.notifications.findMany({
      where: eq(notifications.userId, user!.id),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("welcome");
    expect(rows[0].message).toContain("Bob");
  });

  test("registered credentials verify; wrong password or unknown email do not", async () => {
    await register(
      {},
      formData({
        name: "Carol",
        email: "carol@example.com",
        password: "password123",
      }),
    );

    const user = await verifyCredentials("carol@example.com", "password123");
    expect(user).not.toBeNull();
    expect(user!.name).toBe("Carol");
    expect(
      await verifyCredentials("carol@example.com", "wrong-password"),
    ).toBeNull();
    expect(
      await verifyCredentials("nobody@example.com", "password123"),
    ).toBeNull();
  });

  test("login surfaces invalid credentials as a form-level error", async () => {
    mockedSignIn.mockRejectedValueOnce(new AuthError("CredentialsSignin"));

    const state = await login(
      {},
      formData({ email: "alice@example.com", password: "wrong-password" }),
    );

    expect(state.message).toBe("Invalid email or password.");
    expect(state.values?.email).toBe("alice@example.com");
  });

  test("login delegates valid submissions to Auth.js signIn", async () => {
    const state = await login(
      {},
      formData({ email: "alice@example.com", password: "password123" }),
    );

    expect(state).toEqual({});
    expect(mockedSignIn).toHaveBeenCalledWith("credentials", {
      email: "alice@example.com",
      password: "password123",
      redirectTo: "/",
    });
  });

  test("logout signs the user out and redirects home", async () => {
    await logout();
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/" });
  });
});

describe("registration validation", () => {
  test("returns per-field errors and preserves entered values", async () => {
    const state = await register(
      {},
      formData({ name: "", email: "not-an-email", password: "short" }),
    );

    expect(state.errors?.name?.[0]).toBe("Name is required.");
    expect(state.errors?.email?.[0]).toBe("Enter a valid email address.");
    expect(state.errors?.password?.[0]).toBe(
      "Password must be at least 8 characters.",
    );
    expect(state.values).toEqual({ name: "", email: "not-an-email" });
    expect(await db.$count(users)).toBe(0);
  });

  test("rejects a name longer than 50 characters", async () => {
    const state = await register(
      {},
      formData({
        name: "a".repeat(51),
        email: "long@example.com",
        password: "password123",
      }),
    );
    expect(state.errors?.name?.[0]).toBe("Name must be at most 50 characters.");
  });

  test("rejects a duplicate email", async () => {
    const submission = () =>
      register(
        {},
        formData({
          name: "Alice",
          email: "alice@example.com",
          password: "password123",
        }),
      );
    await submission();
    const state = await submission();

    expect(state.errors?.email?.[0]).toBe("This email is already registered.");
    expect(await db.$count(users)).toBe(1);
  });

  test("login validates the email format", async () => {
    const state = await login(
      {},
      formData({ email: "not-an-email", password: "password123" }),
    );
    expect(state.errors?.email?.[0]).toBe("Enter a valid email address.");
    expect(mockedSignIn).not.toHaveBeenCalled();
  });
});
