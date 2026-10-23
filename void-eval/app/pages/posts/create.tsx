import { Form, useForm } from "@void/react";

export default function PostCreate() {
  const form = useForm("/posts", { title: "", excerpt: "", body: "" });

  return (
    <section>
      <h1>New post</h1>
      <Form form={form}>
        <label>
          Title <input value={form.data.title} onChange={(e) => form.setData("title", e.target.value)} />
        </label>
        {form.errors.title && <p className="error">{form.errors.title}</p>}
        <label>
          Excerpt <input value={form.data.excerpt} onChange={(e) => form.setData("excerpt", e.target.value)} />
        </label>
        {form.errors.excerpt && <p className="error">{form.errors.excerpt}</p>}
        <label>
          Body <textarea rows={10} value={form.data.body} onChange={(e) => form.setData("body", e.target.value)} />
        </label>
        {form.errors.body && <p className="error">{form.errors.body}</p>}
        <button disabled={form.pending}>Publish</button>
      </Form>
    </section>
  );
}
