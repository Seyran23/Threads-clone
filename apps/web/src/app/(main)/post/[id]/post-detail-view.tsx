'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { PostCard } from '@/components/posts/post-card';
import { PostCardSkeleton, PostCardSkeletonList } from '@/components/posts/post-card-skeleton';
import { PostComposer } from '@/components/posts/post-composer';
import { ReplyThread } from '@/components/posts/reply-thread';
import { getPost, getThread } from '@/lib/api/posts';
import { queryKeys } from '@/lib/query-keys';
import { buildReplyTree } from '@/lib/utils/build-reply-tree';

interface PostDetailViewProps {
  postId: string;
}

export function PostDetailView({ postId }: PostDetailViewProps) {
  const postQuery = useQuery({ queryKey: queryKeys.post(postId), queryFn: () => getPost(postId) });
  const threadQuery = useQuery({
    queryKey: queryKeys.thread(postId),
    queryFn: () => getThread(postId),
  });

  const replyTree = useMemo(
    () => buildReplyTree(threadQuery.data?.items ?? [], postId),
    [threadQuery.data, postId],
  );

  return (
    <div className="mx-auto w-full max-w-xl pb-20">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Link href="/" aria-label="Back to feed">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-base font-semibold">Thread</h1>
      </div>

      {postQuery.isLoading && <PostCardSkeleton />}
      {postQuery.isError && (
        <p className="p-4 text-sm text-destructive">Couldn&apos;t load this post.</p>
      )}
      {postQuery.data && (
        <PostCard post={postQuery.data} threadLine={replyTree.length > 0 ? 'start' : undefined} />
      )}

      {threadQuery.isLoading && <PostCardSkeletonList count={2} />}
      {threadQuery.isError && (
        <p className="p-4 text-sm text-destructive">Couldn&apos;t load replies.</p>
      )}
      {threadQuery.data && replyTree.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">No replies yet.</p>
      )}
      <ReplyThread nodes={replyTree} />

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
