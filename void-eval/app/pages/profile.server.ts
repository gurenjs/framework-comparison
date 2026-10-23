import { defineHandler, type InferProps } from "void";
import { ValidationError } from "void/handler";
import { requireAuth } from "void/auth";
import { and, db, eq, ne } from "void/db";
import { users } from "../lib/users";
import { userOrRedirect } from "../lib/guards";
import { profileUpdateSchema } from "../lib/validators";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const user = userOrRedirect(c);
  if (user instanceof Response) return user;
  const [profile] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, user.id));
  return { profile };
});

export const action = defineHandler.withValidator({
  body: profileUpdateSchema,
})(async (c, { body }) => {
  const user = requireAuth(c);
  const [conflict] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, body.email), ne(users.id, user.id)));
  if (conflict) throw new ValidationError({ email: "Email is already in use." });

  await db.update(users).set({ name: body.name, email: body.email }).where(eq(users.id, user.id));
});
