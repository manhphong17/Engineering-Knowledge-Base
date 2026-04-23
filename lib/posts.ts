import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
};

export type Post = PostMeta & {
  content: string;
};

const contentDirectory = path.join(process.cwd(), "content");
const supportedExtensions = new Set([".md", ".mdx"]);

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function parsePostMeta(slug: string, data: Record<string, unknown>): PostMeta {
  const fallbackTitle = slug.split("/").at(-1)?.replace(/[-_]/g, " ") ?? slug;

  return {
    slug,
    title: typeof data.title === "string" ? data.title : fallbackTitle,
    date: typeof data.date === "string" ? data.date : "1970-01-01",
    tags: parseTags(data.tags),
  };
}

function toSlugFromRelativePath(relativePath: string): string {
  const extension = path.extname(relativePath);
  return relativePath.slice(0, -extension.length).split(path.sep).join("/");
}

async function collectPostSlugs(directory: string, basePath = ""): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const slugs: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (entry.isDirectory()) {
      const nestedSlugs = await collectPostSlugs(absolutePath, relativePath);
      slugs.push(...nestedSlugs);
      continue;
    }

    if (entry.isFile() && supportedExtensions.has(path.extname(entry.name))) {
      slugs.push(toSlugFromRelativePath(relativePath));
    }
  }

  return slugs;
}

async function resolvePostPath(
  slug: string,
): Promise<{ filePath: string; normalizedSlug: string } | null> {
  const normalizedSlug = slug
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment).normalize("NFC");
      } catch {
        return segment.normalize("NFC");
      }
    })
    .join("/");
  const basePath = path.join(contentDirectory, ...normalizedSlug.split("/"));

  for (const extension of supportedExtensions) {
    const filePath = `${basePath}${extension}`;
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        return { filePath, normalizedSlug };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function getPostSlugs(): Promise<string[]> {
  try {
    return await collectPostSlugs(contentDirectory);
  } catch {
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const resolved = await resolvePostPath(slug);

  if (!resolved) {
    return null;
  }

  try {
    const file = await fs.readFile(resolved.filePath, "utf8");
    const { data, content } = matter(file);

    return {
      ...parsePostMeta(resolved.normalizedSlug, data),
      content,
    };
  } catch {
    return null;
  }
}

export async function getAllPosts(): Promise<PostMeta[]> {
  const slugs = await getPostSlugs();
  const posts = await Promise.all(slugs.map((slug) => getPostBySlug(slug)));

  return posts
    .filter((post): post is Post => post !== null)
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      date: post.date,
      tags: post.tags,
    }))
    .sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
}
