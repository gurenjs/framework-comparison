import { defineMiddleware } from "void";
import { getUser } from "void/auth";

declare module "void" {
  interface CloudContextVariables {
    shared: { auth: { user: { id: string; name: string; email: string } | null } };
  }
}

export default defineMiddleware(async (c, next) => {
  const user = getUser();
  c.set("shared", { auth: { user: user ? { id: user.id, name: user.name, email: user.email } : null } });
  await next();
});
