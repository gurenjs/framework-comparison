import { Form, useForm } from "@void/react";
import type { Props } from "./profile.server";

export default function Profile({ profile }: Props) {
  const form = useForm("/profile", { name: profile.name, email: profile.email });

  return (
    <section>
      <h1>Profile</h1>
      <Form form={form} method="put">
        <label>
          Name <input value={form.data.name} onChange={(e) => form.setData("name", e.target.value)} />
        </label>
        {form.errors.name && <p className="error">{form.errors.name}</p>}
        <label>
          Email <input type="email" value={form.data.email} onChange={(e) => form.setData("email", e.target.value)} />
        </label>
        {form.errors.email && <p className="error">{form.errors.email}</p>}
        {form.recentlySuccessful && <p>Profile updated successfully.</p>}
        <button disabled={form.pending}>Save</button>
      </Form>
    </section>
  );
}
