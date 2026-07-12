import { type ReactElement } from 'react'
import { type Data } from '@generated/data'
import { Form, Link } from '@adonisjs/inertia/react'

export default function Layout({ children }: { children: ReactElement<Data.SharedProps> }) {
  const { user, flash } = children.props

  return (
    <>
      <header>
        <div>
          <Link route="home" className="brand">
            Minilog
          </Link>
          <nav>
            {user ? (
              <>
                <Link route="posts.create">New post</Link>
                <span>{user.fullName}</span>
                <Form route="session.destroy">
                  <button type="submit">Logout</button>
                </Form>
              </>
            ) : (
              <>
                <Link route="new_account.create">Signup</Link>
                <Link route="session.create">Login</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main>
        {(flash.error || flash.success) && (
          <div className={`alert ${flash.error ? 'alert-destructive' : 'alert-success'}`}>
            {flash.error ?? flash.success}
          </div>
        )}
        {children}
      </main>
    </>
  )
}
