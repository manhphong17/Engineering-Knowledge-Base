import { getAllPosts, type PostMeta } from "@/lib/posts";
import { SidebarClient, type TreeNode } from "./sidebar-client";

// ─── Tree Builder ─────────────────────────────────────────────────────────────

type MutableNode = {
  name: string;
  path: string;
  folders: Map<string, MutableNode>;
  posts: { slug: string; title: string }[];
};

function formatSegment(segment: string): string {
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function createNode(name: string, path: string): MutableNode {
  return { name, path, folders: new Map(), posts: [] };
}

function freezeTree(node: MutableNode): TreeNode {
  return {
    name: node.name,
    path: node.path,
    folders: [...node.folders.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map(freezeTree),
    posts: [...node.posts].sort((a, b) =>
      a.title.localeCompare(b.title, "vi"),
    ),
  };
}

function buildPostTree(posts: PostMeta[]): TreeNode {
  const root = createNode("Knowledge Base", "");

  for (const post of posts) {
    const segments = post.slug.split("/");
    if (!segments.at(-1)) continue;

    let current = root;
    let currentPath = "";

    for (const segment of segments.slice(0, -1)) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (!current.folders.has(segment)) {
        current.folders.set(
          segment,
          createNode(formatSegment(segment), currentPath),
        );
      }
      current = current.folders.get(segment)!;
    }

    current.posts.push({ slug: post.slug, title: post.title });
  }

  return freezeTree(root);
}

// ─── Component ────────────────────────────────────────────────────────────────

export async function KnowledgeSidebar() {
  const posts = await getAllPosts();
  const tree = buildPostTree(posts);
  return <SidebarClient tree={tree} />;
}
