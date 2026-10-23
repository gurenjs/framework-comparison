import type { Props } from "./dashboard.server";

export default function Dashboard({ user }: Props) {
  return (
    <section>
      <h1>Dashboard</h1>
      <p>Signed in as {user.email}</p>
    </section>
  );
}
