import Link from "next/link";

import { getAllPosts } from "@/lib/posts";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getPostHref(slug: string) {
  return `/notes/${slug
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export default async function Home() {
  const posts = await getAllPosts();

  return (
    <main className="page-content">
      <header className="hero">
        <h1>System Design Notes</h1>
        <p>Write and organize your engineering notes by folder tree.</p>
      </header>

      <h2>Recently Updated</h2>
      <ul className="post-list">
        {posts.map((post) => (
          <li key={post.slug} className="post-item">
            <Link href={getPostHref(post.slug)} className="post-link">
              {post.title}
            </Link>
            <p className="post-meta">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              {post.tags.length > 0 && <span> - {post.tags.join(", ")}</span>}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
