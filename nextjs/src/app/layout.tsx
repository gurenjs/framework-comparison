import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "@/lib/actions/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Minilog",
  description: "A minimal multi-user blog.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/" className="brand">
            Minilog
          </Link>
          <nav>
            {session?.user ? (
              <>
                <Link href="/posts/new">New post</Link>
                <span className="muted">{session.user.name}</span>
                <form action={logout}>
                  <button type="submit">Log out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/register">Register</Link>
              </>
            )}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
