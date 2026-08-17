'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { PostCard } from '@/components/posts/post-card';
import { PostComposer } from '@/components/posts/post-composer';
import { getPost, getReplies } from '@/lib/api/posts';
import { queryKeys } from '@/lib/query-keys';

interface PostDetailViewProps {
  postId: string;
}

export function PostDetailView({ postId }: PostDetailViewProps) {
  const postQuery = useQuery({ queryKey: queryKeys.post(postId), queryFn: () => getPost(postId) });
  const repliesQuery = useQuery({
    queryKey: queryKeys.replies(postId),
    queryFn: () => getReplies(postId),
  });

  return (
    <div className="mx-auto w-full max-w-xl pb-20">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Link href="/" aria-label="Back to feed">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-base font-semibold">Thread</h1>
      </div>

      {postQuery.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
      {postQuery.isError && (
        <p className="p-4 text-sm text-destructive">Couldn&apos;t load this post.</p>
      )}
      {postQuery.data && (
        <PostCard
          post={postQuery.data}
          threadLine={repliesQuery.data && repliesQuery.data.items.length > 0 ? 'start' : undefined}
        />
      )}

      {repliesQuery.isLoading && (
        <p className="p-4 text-sm text-muted-foreground">Loading replies…</p>
      )}
      {repliesQuery.isError && (
        <p className="p-4 text-sm text-destructive">Couldn&apos;t load replies.</p>
      )}
      {repliesQuery.data && repliesQuery.data.items.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">No replies yet.</p>
      )}
      {repliesQuery.data?.items.map((reply, index) => (
        <PostCard
          key={reply.id}
          post={reply}
          compact
          threadLine={index === repliesQuery.data.items.length - 1 ? 'end' : 'middle'}
        />
      ))}

      {postQuery.data && (
        <div className="fixed inset-x-0 bottom-0 z-10 bg-background">
          <div className="mx-auto w-full max-w-xl">
            <PostComposer parentId={postId} placeholder="Post your reply" />
          </div>
        </div>
      )}
    </div>
  );
}
