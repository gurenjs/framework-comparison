import { useState, type FormEvent } from "react";
import { Link } from "@void/react";
import { auth } from "void/client";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await auth.signUp.email({ name, email, password });
    setPending(false);
    if (error) {
      setError(error.message ?? "Registration failed.");
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <section>
      <h1>Create an account</h1>
      <form onSubmit={submit}>
        <label>
          Name <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button disabled={pending}>Register</button>
      </form>
      <p>
        Already registered? <Link href="/login">Sign in</Link>
      </p>
    </section>
  );
}
