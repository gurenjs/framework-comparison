import { Head, Link, useForm } from '@inertiajs/react'
import Layout from '../../components/Layout.js'
import type { ValidationErrors } from '@guren/core'

interface Props {
  email?: string
  errors?: ValidationErrors<'email' | 'password'> & { message?: string }
}

type LoginFormData = {
  email: string
  password: string
  remember: boolean
}

export default function Login({ email = '', errors = {} }: Props) {
  const form = useForm<LoginFormData>({ email, password: '', remember: false })

  return (
    <Layout>
      <Head title="Log in" />
      <h1>Log in</h1>
      {errors.message && <p className="error">{errors.message}</p>}
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          form.post('/login')
        }}
      >
        <label>
          Email
          <input type="email" value={form.data.email} onChange={(event) => form.setData('email', event.target.value)} />
          {(form.errors.email ?? errors.email) && <span className="error">{form.errors.email ?? errors.email}</span>}
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.data.password}
            onChange={(event) => form.setData('password', event.target.value)}
          />
          {(form.errors.password ?? errors.password) && (
            <span className="error">{form.errors.password ?? errors.password}</span>
          )}
        </label>
        <label>
          <span>
            <input
              type="checkbox"
              checked={form.data.remember}
              onChange={(event) => form.setData('remember', event.target.checked)}
            />{' '}
            Remember me
          </span>
        </label>
        <button type="submit" disabled={form.processing}>
          Log in
        </button>
      </form>
      <p className="meta">
        No account yet? <Link href="/register">Register</Link>
      </p>
    </Layout>
  )
}
