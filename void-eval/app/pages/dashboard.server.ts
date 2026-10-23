import { defineHandler, type InferProps } from "void";
import { userOrRedirect } from "../lib/guards";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler((c) => {
  const user = userOrRedirect(c);
  if (user instanceof Response) return user;
  return { user: { name: user.name, email: user.email } };
});
