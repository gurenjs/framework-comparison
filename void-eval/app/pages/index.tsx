import { Link } from "@void/react";

export default function Home() {
  return (
    <section>
      <h1>Welcome to the blog</h1>
      <p>
        Read the latest <Link href="/posts">posts</Link>.
      </p>
    </section>
  );
}
