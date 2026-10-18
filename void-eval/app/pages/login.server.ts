import { defineHandler } from "void";
import { guestOrRedirect } from "../lib/guards";

export const loader = defineHandler((c) => {
  return guestOrRedirect(c) ?? {};
});
