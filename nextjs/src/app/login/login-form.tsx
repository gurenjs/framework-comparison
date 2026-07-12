"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <form action={formAction}>
      {state.message && <p className="error">{state.message}</p>}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={state.values?.email}
        />
        {state.errors?.email && (
          <p className="error">{state.errors.email[0]}</p>
        )}
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" />
        {state.errors?.password && (
          <p className="error">{state.errors.password[0]}</p>
        )}
      </div>
      <button type="submit" disabled={pending}>
        Log in
      </button>
    </form>
  );
}
