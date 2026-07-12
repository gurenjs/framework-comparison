import { Link, usePage } from '@inertiajs/react'
import type { PropsWithChildren } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  const { props } = usePage<{ auth?: { user?: { name?: string } } }>()
  const user = props.auth?.user

  return (
    <div>
      <header className="site">
        <div className="container">
          <Link href="/posts">Minilog</Link>
          <nav>
            {user ? (
              <>
                <span className="meta">{user.name}</span>
                <Link href="/posts/create">New post</Link>
                <Link href="/logout" method="post" as="button" className="link">
                  Log out
                </Link>
              </>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/register">Register</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="container">{children}</main>
    </div>
  )
}
