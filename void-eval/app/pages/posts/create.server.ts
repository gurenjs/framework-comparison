import { defineHandler } from "void";
import { userOrRedirect } from "../../lib/guards";

export const loader = defineHandler((c) => {
  const user = userOrRedirect(c);
  return user instanceof Response ? user : {};
});
