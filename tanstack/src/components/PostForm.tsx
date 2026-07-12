import { useState } from 'react'

import type { FieldErrors } from '../server/validation'
import { FieldError } from './FieldError'

type PostFormValues = { title: string; body: string }

export function PostForm({
  initial = { title: '', body: '' },
  submitLabel,
  onSubmit,
}: {
  initial?: PostFormValues
  submitLabel: string
  onSubmit: (values: PostFormValues) => Promise<FieldErrors | undefined>
}) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors>({})

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        const fieldErrors = await onSubmit(values)
        if (fieldErrors) setErrors(fieldErrors)
      }}
    >
      <label>
        Title
        <input
          name="title"
          value={values.title}
          onChange={(event) => setValues({ ...values, title: event.target.value })}
        />
      </label>
      <FieldError messages={errors.title} />
      <label>
        Body
        <textarea
          name="body"
          rows={10}
          value={values.body}
          onChange={(event) => setValues({ ...values, body: event.target.value })}
        />
      </label>
      <FieldError messages={errors.body} />
      <button type="submit">{submitLabel}</button>
    </form>
  )
}
