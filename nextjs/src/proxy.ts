import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

// Optimistically redirect logged-out visitors away from the post forms.
// The Server Actions and pages re-check the session themselves.
export default auth;

export const config = {
  matcher: ["/posts/new", "/posts/:id/edit"],
};
