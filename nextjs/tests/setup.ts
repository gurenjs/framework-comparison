import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, vi } from "vitest";

// Point the app at a throwaway database before any app module is imported.
const dbPath = path.join(os.tmpdir(), `minilog-test-${randomUUID()}.db`);
process.env.DATABASE_URL = dbPath;
process.env.AUTH_SECRET = "test-secret";

// The session helpers are the seam between the app and Auth.js: tests drive
// them directly instead of going through a browser.
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// `after()` needs a request scope; queue the tasks so tests can await them.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  const { enqueueAfter } = await import("./after-queue");
  return { ...actual, after: enqueueAfter };
});

const { db } = await import("@/db");
const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

afterAll(() => {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
});
