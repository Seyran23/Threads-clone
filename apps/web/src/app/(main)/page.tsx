'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { PostCard } from '@/components/posts/post-card';
import { PostComposer } from '@/components/posts/post-composer';
import { Button } from '@/components/ui/button';
import { logoutUser } from '@/lib/api/auth';
import { getFeed } from '@/lib/api/feed';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useInfiniteScrollSentinel } from '@/lib/hooks/use-infinite-scroll-sentinel';
import { queryKeys } from '@/lib/query-keys';

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useCurrentUser();

  useEffect(() => {
    if (isError) {
      router.replace('/login');
    }
  }, [isError, router]);

  const feedQuery = useInfiniteQuery({
    queryKey: queryKeys.feed,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => getFeed({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!data,
  });

  const sentinelRef = useInfiniteScrollSentinel({
    onIntersect: () => {
      if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
        void feedQuery.fetchNextPage();
      }
    },
    enabled: !!feedQuery.hasNextPage,
  });

  if (isPending || isError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  const posts = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center justify-between border-b border-border p-4">
        <p className="text-sm">
          Welcome, <span className="font-semibold">{data.user.username}</span>
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await logoutUser();
            queryClient.clear();
            router.push('/login');
          }}
        >
          Log out
        </Button>
      </div>

      <PostComposer />

      {feedQuery.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading feed…</p>}
      {feedQuery.isError && (
        <p className="p-4 text-sm text-destructive">Couldn&apos;t load the feed.</p>
      )}
      {feedQuery.data && posts.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          No posts yet. Follow people or create the first post.
        </p>
      )}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      <div ref={sentinelRef} className="h-1" />
      {feedQuery.isFetchingNextPage && (
        <p className="p-4 text-center text-sm text-muted-foreground">Loading more…</p>
      )}
    </div>
  );
}
