'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Heart, MessageCircle, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import type { Notification } from '@threads-clone/shared-types';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getNotifications } from '@/lib/api/notifications';
import { useInfiniteScrollSentinel } from '@/lib/hooks/use-infinite-scroll-sentinel';
import { clearNewNotificationBadge } from '@/lib/hooks/use-notification-socket';
import { queryKeys } from '@/lib/query-keys';
import { formatRelativeTime } from '@/lib/utils/relative-time';

const ICON_BY_TYPE = { LIKE: Heart, REPLY: MessageCircle, FOLLOW: UserPlus };

function describe(notification: Notification): string {
  switch (notification.type) {
    case 'LIKE':
      return 'liked your post';
    case 'REPLY':
      return 'replied to your post';
    case 'FOLLOW':
      return 'followed you';
  }
}

function destinationFor(notification: Notification): string {
  return notification.postId
    ? `/post/${notification.postId}`
    : `/profile/${notification.actor.username}`;
}

export default function ActivityPage() {
  const queryClient = useQueryClient();

  useEffect(() => {
    clearNewNotificationBadge(queryClient);
  }, [queryClient]);

  const notificationsQuery = useInfiniteQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getNotifications({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const sentinelRef = useInfiniteScrollSentinel({
    onIntersect: () => {
      if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) {
        void notificationsQuery.fetchNextPage();
      }
    },
    enabled: !!notificationsQuery.hasNextPage,
  });

  const notifications = notificationsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Link href="/" aria-label="Back to feed">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-base font-semibold">Activity</h1>
      </div>

      {notificationsQuery.isLoading && (
        <p className="p-4 text-sm text-muted-foreground">Loading…</p>
      )}
      {notificationsQuery.isError && (
        <p className="p-4 text-sm text-destructive">Couldn&apos;t load activity.</p>
      )}
      {notificationsQuery.data && notifications.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Nothing yet — activity on your posts will show up here.
        </p>
      )}

      {notifications.map((notification) => {
        const Icon = ICON_BY_TYPE[notification.type];
        return (
          <Link
            key={notification.id}
            href={destinationFor(notification)}
            className="flex items-center gap-3 border-b border-border p-4 hover:bg-muted/40"
          >
            <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Avatar>
              {notification.actor.avatarUrl && (
                <AvatarImage
                  src={notification.actor.avatarUrl}
                  alt={`${notification.actor.username}'s avatar`}
                />
              )}
              <AvatarFallback>
                {notification.actor.username.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="min-w-0 flex-1 text-[15px]">
              <span className="font-semibold">{notification.actor.username}</span>{' '}
              <span className="text-muted-foreground">{describe(notification)}</span>
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </Link>
        );
      })}

      <div ref={sentinelRef} className="h-1" />
      {notificationsQuery.isFetchingNextPage && (
        <p className="p-4 text-center text-sm text-muted-foreground">Loading more…</p>
      )}
    </div>
  );
}
