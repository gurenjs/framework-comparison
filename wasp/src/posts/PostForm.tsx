import { useState } from "react";
import { type FieldErrors, fieldErrorsOf } from "../validation";

type PostFormProps = {
  initial?: { title: string; body: string };
  submitLabel: string;
  onSubmit: (values: { title: string; body: string }) => Promise<unknown>;
};

/**
 * SPEC §4 asks that an invalid submission come back with the message next to the
 * offending field and the typed values preserved. The values live in component
 * state and the server's field map is merged in on rejection, so nothing the
 * user typed is lost.
 */
export function PostForm({ initial, submitLabel, onSubmit }: PostFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setPending(true);
    try {
      await onSubmit({ title, body });
    } catch (error) {
      setErrors(fieldErrorsOf(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="title">Title</label>
      <input
        id="title"
        name="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      {errors.title && <p role="alert">{errors.title}</p>}

      <label htmlFor="body">Body</label>
      <textarea
        id="body"
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      {errors.body && <p role="alert">{errors.body}</p>}

      <button type="submit" disabled={pending}>
        {submitLabel}
      </button>
    </form>
  );
}
