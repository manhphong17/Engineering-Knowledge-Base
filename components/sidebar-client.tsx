"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SidebarPost = { slug: string; title: string };

export type TreeNode = {
  name: string;
  path: string;
  folders: TreeNode[];
  posts: SidebarPost[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPostHref(slug: string) {
  return `/notes/${slug.split("/").map(encodeURIComponent).join("/")}`;
}

function isPostActive(slug: string, pathname: string): boolean {
  try {
    const href = getPostHref(slug);
    return (
      pathname === href ||
      decodeURIComponent(pathname) === decodeURIComponent(href)
    );
  } catch {
    return false;
  }
}

// ─── Tree Branch ──────────────────────────────────────────────────────────────

function TreeBranch({
  node,
  pathname,
}: {
  node: TreeNode;
  pathname: string;
}) {
  return (
    <ul className="sb-list">
      {node.folders.map((folder) => (
        <li key={folder.path}>
          <details className="sb-folder" open>
            <summary>{folder.name}</summary>
            <TreeBranch node={folder} pathname={pathname} />
          </details>
        </li>
      ))}
      {node.posts.map((post) => (
        <li key={post.slug}>
          <Link
            href={getPostHref(post.slug)}
            className={`sb-link${isPostActive(post.slug, pathname) ? " sb-link-active" : ""}`}
          >
            {post.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ─── Sidebar Client ───────────────────────────────────────────────────────────

export function SidebarClient({ tree }: { tree: TreeNode }) {
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kb-sidebar-open");
      if (saved === "false") setOpen(false);
    } catch {
      // ignore
    }
    // Delay enabling transitions so initial state renders without animation
    const id = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(id);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem("kb-sidebar-open", String(next));
    } catch {
      // ignore
    }
  };

  const sidebarClass = [
    "sidebar",
    !open && "sidebar-collapsed",
    !mounted && "sidebar-no-transition",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* Mobile: floating open button visible only when sidebar is closed */}
      {mounted && !open && (
        <button
          className="sb-mobile-open"
          onClick={toggle}
          aria-label="Open sidebar"
        >
          ☰
        </button>
      )}

      {/* Mobile backdrop */}
      {mounted && open && (
        <div
          className="sb-backdrop"
          onClick={toggle}
          aria-hidden="true"
        />
      )}

      <aside className={sidebarClass} aria-label="Knowledge base navigation">
        <div className="sidebar-inner">
          {/* ── Header ── */}
          <div className="sb-header">
            <button
              className="sb-toggle"
              onClick={toggle}
              aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
            >
              {open ? "‹" : "›"}
            </button>
            <Link href="/" className="sb-brand">
              <span className="sb-brand-icon">📚</span>
              <span className="sb-brand-text">Knowledge Base</span>
            </Link>
          </div>

          {/* ── Navigation Tree ── */}
          <nav className="sb-nav">
            {tree.posts.length === 0 && tree.folders.length === 0 ? (
              <p className="sb-empty">Chưa có bài viết.</p>
            ) : (
              <TreeBranch node={tree} pathname={pathname} />
            )}
          </nav>
        </div>
      </aside>
    </>
  );
}
