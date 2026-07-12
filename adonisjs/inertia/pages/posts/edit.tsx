import { Form } from '@adonisjs/inertia/react'
import type { InertiaProps } from '~/types'
import type { Data } from '@generated/data'

type PageProps = InertiaProps<{
  post: Data.Post
}>

export default function Edit({ post }: PageProps) {
  return (
    <>
      <h1>Edit post</h1>

      <Form route="posts.update" routeParams={{ id: post.id }}>
        {({ errors, processing }) => (
          <>
            <div>
              <label htmlFor="title">Title</label>
              <input
                type="text"
                name="title"
                id="title"
                defaultValue={post.title}
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
                defaultValue={post.body}
                data-invalid={errors.body ? 'true' : undefined}
              />
              {errors.body && <div>{errors.body}</div>}
            </div>

            <div>
              <button type="submit" disabled={processing}>
                Update post
              </button>
            </div>
          </>
        )}
      </Form>
    </>
  )
}
