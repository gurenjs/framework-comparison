import { useState, type FormEvent } from "react";
import { Link } from "@void/react";
import { auth } from "void/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await auth.signIn.email({ email, password });
    setPending(false);
    if (error) {
      setError(error.message ?? "Invalid credentials.");
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <section>
      <h1>Sign in</h1>
      <form onSubmit={submit}>
        <label>
          Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button disabled={pending}>Sign in</button>
      </form>
      <p>
        No account? <Link href="/register">Create an account</Link>
      </p>
    </section>
  );
}
