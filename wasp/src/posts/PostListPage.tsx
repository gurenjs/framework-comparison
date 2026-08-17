import { useState } from "react";
import { Link } from "react-router";
import { getPosts, useQuery } from "wasp/client/operations";

export function PostListPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery(getPosts, { page });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p role="alert">{error.message}</p>;
  if (!data) return null;

  return (
    <main>
      <h1>Posts</h1>
      <ul>
        {data.posts.map((post) => (
          <li key={post.id}>
            <Link to={`/posts/${post.id}`}>{post.title}</Link>
            <span> by {post.author.name}</span>
          </li>
        ))}
      </ul>

      <nav>
        <button
          type="button"
          disabled={data.page <= 1}
          onClick={() => setPage(data.page - 1)}
        >
          Previous
        </button>
        <span>
          Page {data.page} of {data.totalPages}
        </span>
        <button
          type="button"
          disabled={data.page >= data.totalPages}
          onClick={() => setPage(data.page + 1)}
        >
          Next
        </button>
      </nav>
    </main>
  );
}
