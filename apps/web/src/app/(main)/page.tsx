'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Menu, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { ThreadsLogo } from '@/components/layout/threads-logo';
import { PostCard } from '@/components/posts/post-card';
import { PostCardSkeletonList } from '@/components/posts/post-card-skeleton';
import { PostComposer } from '@/components/posts/post-composer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logoutUser } from '@/lib/api/auth';
import { getFeed } from '@/lib/api/feed';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useInfiniteScrollSentinel } from '@/lib/hooks/use-infinite-scroll-sentinel';
import { useHasNewNotification } from '@/lib/hooks/use-notification-socket';
import { queryKeys } from '@/lib/query-keys';

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useCurrentUser();
  const hasNewNotification = useHasNewNotification();

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
    <div className="mx-auto w-full max-w-xl">
      <div className="flex items-center justify-between border-b border-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="text-foreground" aria-label="Menu">
            <Menu className="size-6" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{data.user.username}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push(`/profile/${data.user.username}`)}>
              View profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/saved')}>Saved</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/blocked')}>
              Blocked accounts
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/graph')}>Network</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await logoutUser();
                queryClient.clear();
                router.push('/login');
              }}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <h1 className="sr-only">Home</h1>
        <ThreadsLogo className="text-foreground" />

        <div className="flex items-center gap-4">
          <Link href="/search" aria-label="Search">
            <Search className="size-6" />
          </Link>
          <Link href="/activity" aria-label="Notifications" className="relative">
            <Bell className="size-6" />
            {hasNewNotification && (
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive" />
            )}
          </Link>
        </div>
      </div>

      <PostComposer />

      {feedQuery.isLoading && <PostCardSkeletonList />}
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
