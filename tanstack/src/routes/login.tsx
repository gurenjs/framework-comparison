import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import { FieldError } from '../components/FieldError'
import { loginFn } from '../server/auth.functions'
import type { FieldErrors } from '../server/validation'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const login = useServerFn(loginFn)
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <>
      <h1>Log in</h1>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          setErrors({})
          setFormError(null)
          const result = await login({ data: values })
          if (result?.errors) setErrors(result.errors)
          else if (result?.formError) setFormError(result.formError)
        }}
      >
        {formError && <p className="form-error">{formError}</p>}
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
        <button type="submit">Log in</button>
      </form>
    </>
  )
}
