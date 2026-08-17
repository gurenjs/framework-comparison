import { Link } from "react-router";
import { SignupForm } from "wasp/client/auth";

export function SignupPage() {
  return (
    <main>
      <h1>Sign up</h1>
      <SignupForm
        additionalFields={[
          {
            name: "name",
            type: "input",
            label: "Name",
            validations: {
              required: "Name is required",
              maxLength: {
                value: 50,
                message: "Name must be at most 50 characters",
              },
            },
          },
        ]}
      />
      <p>
        Already have an account? <Link to="/login">Log in</Link>.
      </p>
    </main>
  );
}
