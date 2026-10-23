// Shared judgements for tests/extras/*.robustness.test.ts: properties each
// ticket's statement asks for (or the app already guaranteed) that the graded
// tests do not exercise. Framework-neutral: a validation refusal is either the
// driver's field errors or a 400/422 status; a server error is any 5xx.
import type { Submit } from '../drivers/types.ts'

export const isServerError = (res: { status: number }) => res.status >= 500

/** Refused as invalid input: field errors (Guren 422 JSON, Void page errors) or 400/422. */
export const isValidationRefusal = (res: Submit) => Object.keys(res.errors ?? {}).length > 0 || [400, 422].includes(res.status)

/** A guest sent to the login page (session routes) or refused with 401 (JSON routes). */
export const isGuestRefusal = (res: { status: number; location?: string | null }) =>
  res.status === 401 || ([302, 303].includes(res.status) && /\/login(\?|$)/.test(res.location ?? ''))

/** Refused for someone who may not act on the record: 403, or 404 when the app hides it. */
export const isForbidden = (res: { status: number }) => [403, 404].includes(res.status)
