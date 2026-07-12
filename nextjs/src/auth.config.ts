import type { NextAuthConfig } from "next-auth";

/**
 * Auth config shared between the proxy (route protection) and the full
 * NextAuth instance in `auth.ts`. Kept free of database imports so the
 * proxy stays lightweight.
 */
export const authConfig = {
  // Self-hosted deployment: trust the Host header from the serving proxy.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Only invoked for routes matched by the proxy; a falsy return
    // redirects to the sign-in page.
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
