import type { Post } from '@threads-clone/shared-types';

export interface ReplyNode {
  post: Post;
  relativeDepth: number;
  children: ReplyNode[];
}

export function buildReplyTree(items: Post[], rootId: string): ReplyNode[] {
  const childrenByParent = new Map<string, Post[]>();
  for (const post of items) {
    if (!post.parentId) {
      continue;
    }
    const siblings = childrenByParent.get(post.parentId) ?? [];
    siblings.push(post);
    childrenByParent.set(post.parentId, siblings);
  }

  function build(parentId: string, relativeDepth: number): ReplyNode[] {
    const children = childrenByParent.get(parentId) ?? [];
    return children.map((post) => ({
      post,
      relativeDepth,
      children: build(post.id, relativeDepth + 1),
    }));
  }

  return build(rootId, 1);
}
