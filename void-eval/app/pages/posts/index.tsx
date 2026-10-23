import { useState } from "react";
import { Link, useRouter } from "@void/react";
import type { Props } from "./index.server";

export default function PostsIndex({ data, q, pagination }: Props) {
  const { meta } = pagination;
  const [keywords, setKeywords] = useState(q);
  const router = useRouter();
  const pages = Array.from({ length: meta.lastPage }, (_, i) => i + 1);
  const query = (page: number) => ({ page, ...(q ? { q } : {}) });

  return (
    <section>
      <h1>Posts</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          router.visit("/posts", { data: keywords ? { q: keywords } : {} });
        }}
      >
        <input type="search" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Search posts…" />
        <button>Search</button>
      </form>

      {data.map((post) => (
        <article key={post.id}>
          <Link href={`/posts/${post.id}`}>{post.title}</Link>
          <p>{post.excerpt}</p>
          <small>by {post.author.name}</small>
        </article>
      ))}

      <p>
        {meta.from ?? 0}–{meta.to ?? 0} of {meta.total}
      </p>
      <nav className="pager">
        <Link href="/posts" data={query(1)}>First</Link>
        {meta.currentPage > 1 && <Link href="/posts" data={query(meta.currentPage - 1)}>Previous</Link>}
        {pages.map((page) => (
          <Link key={page} href="/posts" data={query(page)} aria-current={page === meta.currentPage ? "page" : undefined}>
            {page}
          </Link>
        ))}
        {meta.currentPage < meta.lastPage && <Link href="/posts" data={query(meta.currentPage + 1)}>Next</Link>}
        <Link href="/posts" data={query(meta.lastPage)}>Last</Link>
      </nav>
    </section>
  );
}
