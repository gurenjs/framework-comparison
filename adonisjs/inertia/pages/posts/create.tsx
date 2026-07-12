import { Form } from '@adonisjs/inertia/react'
import type { InertiaProps } from '~/types'

type PageProps = InertiaProps<{}>

export default function Create({}: PageProps) {
  return (
    <>
      <h1>New post</h1>

      <Form route="posts.store">
        {({ errors, processing }) => (
          <>
            <div>
              <label htmlFor="title">Title</label>
              <input
                type="text"
                name="title"
                id="title"
                data-invalid={errors.title ? 'true' : undefined}
              />
              {errors.title && <div>{errors.title}</div>}
            </div>

            <div>
              <label htmlFor="body">Body</label>
              <textarea
                name="body"
                id="body"
                rows={10}
                data-invalid={errors.body ? 'true' : undefined}
              />
              {errors.body && <div>{errors.body}</div>}
            </div>

            <div>
              <button type="submit" disabled={processing}>
                Create post
              </button>
            </div>
          </>
        )}
      </Form>
    </>
  )
}
