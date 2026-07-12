import vine from '@vinejs/vine'

/**
 * Validator for creating and updating posts
 */
export const postValidator = vine.create({
  title: vine.string().trim().minLength(1).maxLength(120),
  body: vine.string().trim().minLength(1).maxLength(10_000),
})
