import { createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { PostForm } from '../components/PostForm'
import { createPostFn } from '../server/posts.functions'

export const Route = createFileRoute('/posts/new')({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: '/login' })
  },
  component: NewPostPage,
})

function NewPostPage() {
  const createPost = useServerFn(createPostFn)

  return (
    <>
      <h1>New post</h1>
      <PostForm
        submitLabel="Create post"
        onSubmit={async (values) => (await createPost({ data: values }))?.errors}
      />
    </>
  )
}
