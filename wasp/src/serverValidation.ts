import { HttpError } from "wasp/server";
import type { FieldErrors } from "./validation";

/**
 * SPEC §4 field rules, in one place. Operations validate before touching an
 * entity and throw a 422 carrying a field-keyed map, which the forms render next
 * to the offending input while keeping what the user typed.
 *
 * Server-only: nothing on the client may import this file. See validation.ts.
 */
export function invalid(errors: FieldErrors): never {
  throw new HttpError(422, "Validation failed", { fieldErrors: errors });
}

export function requireLength(
  value: unknown,
  field: string,
  min: number,
  max: number,
  label: string,
): string {
  if (typeof value !== "string" || value.trim().length < min) {
    invalid({ [field]: `${label} is required.` });
  }
  const trimmed = (value as string).trim();
  if (trimmed.length > max) {
    invalid({ [field]: `${label} must be at most ${max} characters.` });
  }
  return trimmed;
}

export function requireId(value: unknown, field: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    invalid({ [field]: "Invalid identifier." });
  }
  return id;
}
