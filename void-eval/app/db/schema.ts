import { sql } from "void/db";
import { integer, sqliteTable, text } from "void/schema-d1";

// Authors are Better Auth users (the `user` table Void manages); see
// lib/users.ts for the read-only mapping used in joins.
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  body: text("body").notNull(),
  authorId: text("author_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});
