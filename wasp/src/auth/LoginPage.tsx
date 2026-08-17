import { Link } from "react-router";
import { LoginForm } from "wasp/client/auth";

export function LoginPage() {
  return (
    <main>
      <h1>Log in</h1>
      <LoginForm />
      <p>
        No account yet? <Link to="/signup">Sign up</Link>.
      </p>
    </main>
  );
}
