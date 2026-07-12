"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation";

export function PostForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  initial?: { title: string; body: string };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      {state.message && <p className="error">{state.message}</p>}
      <div className="field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          defaultValue={state.values?.title ?? initial?.title}
        />
        {state.errors?.title && <p className="error">{state.errors.title[0]}</p>}
      </div>
      <div className="field">
        <label htmlFor="body">Body</label>
        <textarea
          id="body"
          name="body"
          defaultValue={state.values?.body ?? initial?.body}
        />
        {state.errors?.body && <p className="error">{state.errors.body[0]}</p>}
      </div>
      <button type="submit" disabled={pending}>
        {submitLabel}
      </button>
    </form>
  );
}
