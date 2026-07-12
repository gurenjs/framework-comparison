import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import { FieldError } from '../components/FieldError'
import { registerFn } from '../server/auth.functions'
import type { FieldErrors } from '../server/validation'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const register = useServerFn(registerFn)
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors>({})

  return (
    <>
      <h1>Register</h1>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          const result = await register({ data: values })
          if (result?.errors) setErrors(result.errors)
        }}
      >
        <label>
          Name
          <input
            name="name"
            value={values.name}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
          />
        </label>
        <FieldError messages={errors.name} />
        <label>
          Email
          <input
            name="email"
            type="email"
            value={values.email}
            onChange={(event) => setValues({ ...values, email: event.target.value })}
          />
        </label>
        <FieldError messages={errors.email} />
        <label>
          Password
          <input
            name="password"
            type="password"
            value={values.password}
            onChange={(event) => setValues({ ...values, password: event.target.value })}
          />
        </label>
        <FieldError messages={errors.password} />
        <button type="submit">Register</button>
      </form>
    </>
  )
}
