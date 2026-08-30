import type { ReplyNode } from '@/lib/utils/build-reply-tree';

import { PostCard } from './post-card';

const INDENT_CLASSES = [
  'ml-0 pl-0',
  'ml-4 border-l border-border pl-2',
  'ml-8 border-l border-border pl-2',
  'ml-12 border-l border-border pl-2',
] as const;

interface ReplyThreadNodeProps {
  node: ReplyNode;
}

function ReplyThreadNode({ node }: ReplyThreadNodeProps) {
  const indentClass = INDENT_CLASSES[Math.min(node.relativeDepth - 1, 3)];

  return (
    <div className={indentClass}>
      <PostCard post={node.post} compact />
      {node.children.map((child) => (
        <ReplyThreadNode key={child.post.id} node={child} />
      ))}
    </div>
  );
}

interface ReplyThreadProps {
  nodes: ReplyNode[];
}

export function ReplyThread({ nodes }: ReplyThreadProps) {
  return (
    <>
      {nodes.map((node) => (
        <ReplyThreadNode key={node.post.id} node={node} />
      ))}
    </>
  );
}
