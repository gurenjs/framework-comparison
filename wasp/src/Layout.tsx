import type { ReactNode } from "react";
import { Link } from "react-router";
import { logout, useAuth } from "wasp/client/auth";
import "./Main.css";

export function Layout({ children }: { children: ReactNode }) {
  const { data: user } = useAuth();

  return (
    <div>
      <header>
        <Link to="/">Minilog</Link>
        {user ? (
          <>
            <Link to="/posts/new">New post</Link>
            <span>{user.name}</span>
            <button type="button" onClick={() => logout()}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </>
        )}
      </header>
      {children}
    </div>
  );
}
