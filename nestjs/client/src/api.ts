import type { FieldErrors } from './types';

export class ApiError extends Error {
  status: number;
  fieldErrors: FieldErrors;

  constructor(status: number, body: unknown) {
    // Nest error responses carry `message`; our 422s carry per-field `errors`.
    const record = (typeof body === 'object' && body !== null ? body : {}) as {
      message?: string | string[];
      errors?: FieldErrors;
    };
    const message = Array.isArray(record.message)
      ? record.message[0]
      : record.message;
    super(message ?? `Request failed with status ${status}`);
    this.status = status;
    this.fieldErrors = record.errors ?? {};
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body: unknown = res.status === 204 ? undefined : await res.json();
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

function jsonInit(method: string, data: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown = {}) =>
    request<T>(path, jsonInit('POST', data)),
  put: <T>(path: string, data: unknown) =>
    request<T>(path, jsonInit('PUT', data)),
  delete: (path: string) => request<undefined>(path, { method: 'DELETE' }),
};
