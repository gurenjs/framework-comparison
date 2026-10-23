import { Form, useForm } from "@void/react";
import type { Props } from "./edit.server";

export default function PostEdit({ post }: Props) {
  const form = useForm(
    "/posts/:id?update",
    { title: post.title, excerpt: post.excerpt, body: post.body },
    { params: { id: String(post.id) } },
  );

  return (
    <section>
      <h1>Edit post</h1>
      <Form form={form} method="put">
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
        <button disabled={form.pending}>Save changes</button>
      </Form>
    </section>
  );
}
