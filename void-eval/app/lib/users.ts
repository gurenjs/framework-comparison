import { sqliteTable, text } from "void/schema-d1";

// Read-only view of the `user` table that Void's auth (Better Auth) creates
// and migrates itself. It lives outside db/schema.ts on purpose: tables there
// get migrations generated, and this one is not ours to migrate.
export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
});
