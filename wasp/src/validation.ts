/**
 * Client-safe half of the §4 validation contract: the shape of the field map and
 * how to read it back off a rejected operation.
 *
 * Deliberately imports nothing from `wasp/server`. The throwing helpers live in
 * `src/serverValidation.ts` — when both halves shared one module, the pages
 * imported it, that pulled `wasp/server` into the client graph, and the server
 * ended up with two copies of `HttpError`: the one bundled into the server and
 * the one resolved from the SDK. `err instanceof HttpError` was then false in
 * Wasp's error handler, so every 4xx came back as an HTML error page instead of
 * the JSON body carrying `data`, and no field error ever reached a form.
 */
export type FieldErrors = Record<string, string>;

/** Pulls the field map back out of the error a failed operation rejects with. */
export function fieldErrorsOf(error: unknown): FieldErrors {
  const data = (error as { data?: { fieldErrors?: FieldErrors } } | null)?.data;
  return data?.fieldErrors ?? {};
}
