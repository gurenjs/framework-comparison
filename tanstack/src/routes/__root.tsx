import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { useServerFn } from '@tanstack/react-start'

import { currentUserFn, logoutFn } from '../server/auth.functions'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  beforeLoad: async () => {
    const user = await currentUserFn()
    return { user }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Minilog' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const logout = useServerFn(logoutFn)

  return (
    <div className="container">
      <header>
        <Link to="/" className="brand">
          Minilog
        </Link>
        <nav>
          {user ? (
            <>
              <Link to="/posts/new">New post</Link>
              <span className="meta">{user.name}</span>
              <button
                type="button"
                onClick={async () => {
                  await logout()
                  await router.invalidate()
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
