import type { Context } from "hono";
import { getUser, type AuthUser } from "void/auth";

/** For pages: signed-in users get the user, guests are sent to the sign-in page. */
export function userOrRedirect(c: Context): AuthUser | Response {
  return getUser() ?? c.redirect("/login");
}

/** For guest-only pages (sign in, register): signed-in users go to the dashboard. */
export function guestOrRedirect(c: Context): Response | null {
  return getUser() ? c.redirect("/dashboard") : null;
}
