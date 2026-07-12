import { Head, Link, useForm } from '@inertiajs/react'
import Layout from '../../components/Layout.js'

type RegisterFormData = {
  name: string
  email: string
  password: string
}

export default function Register() {
  const form = useForm<RegisterFormData>({ name: '', email: '', password: '' })

  return (
    <Layout>
      <Head title="Register" />
      <h1>Register</h1>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          form.post('/register')
        }}
      >
        <label>
          Name
          <input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} />
          {form.errors.name && <span className="error">{form.errors.name}</span>}
        </label>
        <label>
          Email
          <input type="email" value={form.data.email} onChange={(event) => form.setData('email', event.target.value)} />
          {form.errors.email && <span className="error">{form.errors.email}</span>}
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.data.password}
            onChange={(event) => form.setData('password', event.target.value)}
          />
          {form.errors.password && <span className="error">{form.errors.password}</span>}
        </label>
        <button type="submit" disabled={form.processing}>
          Create account
        </button>
      </form>
      <p className="meta">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </Layout>
  )
}
