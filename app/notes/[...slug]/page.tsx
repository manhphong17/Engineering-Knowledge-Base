import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import type { ReactNode } from "react";
import { isValidElement } from "react";
import remarkGfm from "remark-gfm";

import { MdxImage } from "@/components/mdx-image";
import { getAllPosts, getPostBySlug } from "@/lib/posts";

type NotePageProps = {
  params: Promise<{ slug: string[] }>;
};

type TocItem = {
  id: string;
  text: string;
  level: 2 | 3 | 4;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toSlugPath(segments: string[]) {
  return segments
    .map((segment) => {
      try {
        return decodeURIComponent(segment).normalize("NFC");
      } catch {
        return segment.normalize("NFC");
      }
    })
    .join("/");
}

function normalizeSlugText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function createSlugFactory() {
  const used = new Map<string, number>();

  return (rawText: string) => {
    const base = normalizeSlugText(rawText) || "section";
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

function stripMdxSyntax(value: string) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[\*_~#]/g, "")
    .trim();
}

function getTextFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (!node || typeof node !== "object") {
    return "";
  }

  if (Array.isArray(node)) {
    return node.map((child) => getTextFromNode(child)).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getTextFromNode(node.props.children);
  }

  return "";
}

function buildTableOfContents(content: string): TocItem[] {
  const slugForHeading = createSlugFactory();
  const lines = content.split(/\r?\n/);
  const toc: TocItem[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{2,4})\s+(.+)$/);
    if (!match) {
      continue;
    }

    const level = match[1].length as 2 | 3 | 4;
    const text = stripMdxSyntax(match[2]);

    if (!text) {
      continue;
    }

    toc.push({
      id: slugForHeading(text),
      text,
      level,
    });
  }

  return toc;
}

function createMdxHeadingComponents() {
  const slugForHeading = createSlugFactory();

  return {
    h2: ({ children }: { children: ReactNode }) => {
      const text = getTextFromNode(children).trim();
      const id = slugForHeading(text);
      return <h2 id={id}>{children}</h2>;
    },
    h3: ({ children }: { children: ReactNode }) => {
      const text = getTextFromNode(children).trim();
      const id = slugForHeading(text);
      return <h3 id={id}>{children}</h3>;
    },
    h4: ({ children }: { children: ReactNode }) => {
      const text = getTextFromNode(children).trim();
      const id = slugForHeading(text);
      return <h4 id={id}>{children}</h4>;
    },
    img: MdxImage,
  };
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug.split("/") }));
}

export async function generateMetadata({
  params,
}: NotePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(toSlugPath(slug));

  if (!post) {
    return { title: "Note Not Found" };
  }

  return {
    title: post.title,
    description: `System design note: ${post.title}`,
  };
}

export default async function NotePage({ params }: NotePageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(toSlugPath(slug));

  if (!post) {
    notFound();
  }

  const toc = buildTableOfContents(post.content);
  const mdxComponents = {
    ...createMdxHeadingComponents(),
    // Suppress h1 from MDX: page header already renders the title
    h1: () => null,
  };

  return (
    <main className="note-page">
      <p>
        <Link href="/" className="back-link">
          &larr; Back to notes
        </Link>
      </p>

      <div className="note-layout">
        <article className="note">
          <header>
            <h1>{post.title}</h1>
            <p className="post-meta">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              {post.tags.length > 0 && (
                <span> - {post.tags.join(", ")}</span>
              )}
            </p>
          </header>

          <div className="mdx-content">
            <MDXRemote
              source={post.content}
              components={mdxComponents}
              options={{
                mdxOptions: {
                  remarkPlugins: [remarkGfm],
                },
              }}
            />
          </div>
        </article>

        {toc.length > 0 && (
          <aside className="toc">
            <h2 className="toc-title">Mục lục</h2>
            <nav>
              <ul className="toc-list">
                {toc.map((item) => (
                  <li key={item.id} className={`toc-item level-${item.level}`}>
                    <a href={`#${item.id}`}>{item.text}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}
      </div>
    </main>
  );
}
