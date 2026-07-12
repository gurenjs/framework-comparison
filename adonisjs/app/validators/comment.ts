import vine from '@vinejs/vine'

/**
 * Validator for creating comments
 */
export const commentValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(1_000),
})
