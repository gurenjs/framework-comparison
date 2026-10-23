import { Link, useShared } from "@void/react";
import { auth } from "void/client";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { auth: shared } = useShared();
  const user = shared?.user ?? null;

  async function signOut() {
    await auth.signOut();
    window.location.href = "/";
  }

  return (
    <>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/posts">Posts</Link>
        {user ? (
          <>
            <Link href="/posts/create">New post</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/profile">Profile</Link>
            <button type="button" onClick={signOut}>Sign out</button>
          </>
        ) : (
          <>
            <Link href="/login">Sign in</Link>
            <Link href="/register">Register</Link>
          </>
        )}
      </nav>
      <main>{children}</main>
    </>
  );
}
