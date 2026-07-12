import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { PostForm } from '../components/PostForm'
import { getPostFn, updatePostFn } from '../server/posts.functions'

export const Route = createFileRoute('/posts/$postId/edit')({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: '/login' })
    return { user: context.user }
  },
  loader: async ({ params, context }) => {
    const id = Number(params.postId)
    const post =
      Number.isInteger(id) && id > 0 ? await getPostFn({ data: { id } }) : null
    // Non-authors get a 404 rather than a 403; the mutation is also rejected
    // server-side (SPEC allows "hidden + rejected" — see README).
    if (!post || post.author.id !== context.user.id) throw notFound()
    return post
  },
  notFoundComponent: () => <p>Post not found.</p>,
  component: EditPostPage,
})

function EditPostPage() {
  const post = Route.useLoaderData()
  const updatePost = useServerFn(updatePostFn)

  return (
    <>
      <h1>Edit post</h1>
      <PostForm
        initial={{ title: post.title, body: post.body }}
        submitLabel="Save changes"
        onSubmit={async (values) =>
          (await updatePost({ data: { id: post.id, ...values } }))?.errors
        }
      />
    </>
  )
}
