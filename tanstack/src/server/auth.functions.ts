import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { getUserById, registerUser, verifyCredentials } from './auth'
import { useAppSession } from './session'
import { LoginSchema, fieldErrors } from './validation'

export const currentUserFn = createServerFn().handler(async () => {
  const session = await useAppSession()
  const { userId } = session.data
  if (!userId) return null
  return getUserById(userId)
})

export const registerFn = createServerFn({ method: 'POST' })
  .validator((data: { name: string; email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const result = await registerUser(data)
    if (result.status === 'invalid') return { errors: result.errors }

    const session = await useAppSession()
    await session.update({ userId: result.user.id })
    throw redirect({ to: '/' })
  })

export const loginFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const parsed = LoginSchema.safeParse(data)
    if (!parsed.success) return { errors: fieldErrors(parsed.error) }

    const user = await verifyCredentials(parsed.data.email, parsed.data.password)
    if (!user) return { formError: 'Invalid email or password.' }

    const session = await useAppSession()
    await session.update({ userId: user.id })
    throw redirect({ to: '/' })
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await useAppSession()
  await session.clear()
  throw redirect({ to: '/' })
})
