import Link from "next/link";
import { getPostsPage } from "@/lib/data";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const { posts, totalPages } = await getPostsPage(currentPage);

  return (
    <>
      <h1>Posts</h1>
      {posts.length === 0 ? (
        <p className="muted">No posts yet.</p>
      ) : (
        posts.map((post) => (
          <article key={post.id}>
            <h2>
              <Link href={`/posts/${post.id}`}>{post.title}</Link>
            </h2>
            <p className="muted">
              by {post.author.name} on {post.createdAt.toLocaleDateString()}
            </p>
          </article>
        ))
      )}
      <div className="pagination">
        {currentPage > 1 && (
          <Link href={`/?page=${currentPage - 1}`}>← Newer</Link>
        )}
        <span className="muted">
          Page {currentPage} of {totalPages}
        </span>
        {currentPage < totalPages && (
          <Link href={`/?page=${currentPage + 1}`}>Older →</Link>
        )}
      </div>
    </>
  );
}
