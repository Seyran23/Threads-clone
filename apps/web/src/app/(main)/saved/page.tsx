'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { PostCard } from '@/components/posts/post-card';
import { getSavedPosts } from '@/lib/api/users';
import { useInfiniteScrollSentinel } from '@/lib/hooks/use-infinite-scroll-sentinel';
import { queryKeys } from '@/lib/query-keys';

export default function SavedPostsPage() {
  const savedQuery = useInfiniteQuery({
    queryKey: queryKeys.savedPosts,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getSavedPosts({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const sentinelRef = useInfiniteScrollSentinel({
    onIntersect: () => {
      if (savedQuery.hasNextPage && !savedQuery.isFetchingNextPage) {
        void savedQuery.fetchNextPage();
      }
    },
    enabled: !!savedQuery.hasNextPage,
  });

  const posts = savedQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Link href="/" aria-label="Back to feed">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-base font-semibold">Saved</h1>
      </div>

      {savedQuery.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
      {savedQuery.isError && (
        <p className="p-4 text-sm text-destructive">Couldn&apos;t load saved posts.</p>
      )}
      {savedQuery.data && posts.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Posts you save will show up here.
        </p>
      )}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      <div ref={sentinelRef} className="h-1" />
      {savedQuery.isFetchingNextPage && (
        <p className="p-4 text-center text-sm text-muted-foreground">Loading more…</p>
      )}
    </div>
  );
}
