'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Heart, MessageCircle, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import type { FollowRequest, Notification, NotificationsPage } from '@threads-clone/shared-types';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { RowSkeletonList } from '@/components/ui/row-skeleton';
import { acceptFollowRequest, getFollowRequests, rejectFollowRequest } from '@/lib/api/follows';
import { getNotifications } from '@/lib/api/notifications';
import { useInfiniteScrollSentinel } from '@/lib/hooks/use-infinite-scroll-sentinel';
import { clearNewNotificationBadge } from '@/lib/hooks/use-notification-socket';
import { queryKeys } from '@/lib/query-keys';
import { describeNotification } from '@/lib/utils/notification-text';
import { formatRelativeTime } from '@/lib/utils/relative-time';

const ICON_BY_TYPE = {
  LIKE: Heart,
  REPLY: MessageCircle,
  FOLLOW: UserPlus,
  FOLLOW_REQUEST: UserPlus,
};

function updateFollowRequestNotification(
  queryClient: QueryClient,
  requesterId: string,
  outcome: 'accepted' | 'declined',
): void {
  queryClient.setQueriesData<{ pages: NotificationsPage[]; pageParams: unknown[] }>(
    { queryKey: queryKeys.notifications },
    (data) => {
      if (!data) {
        return data;
      }
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items:
            outcome === 'declined'
              ? page.items.filter(
                  (n) => !(n.type === 'FOLLOW_REQUEST' && n.actor.id === requesterId),
                )
              : page.items.map((n) =>
                  n.type === 'FOLLOW_REQUEST' && n.actor.id === requesterId
                    ? { ...n, type: 'FOLLOW' as const }
                    : n,
                ),
        })),
      };
    },
  );
}

function FollowRequestRow({ request }: { request: FollowRequest }) {
  const queryClient = useQueryClient();

  const removeFromRequestsList = () => {
    queryClient.setQueryData<FollowRequest[]>(queryKeys.followRequests, (data) =>
      data?.filter((r) => r.id !== request.id),
    );
  };

  const acceptMutation = useMutation({
    mutationFn: () => acceptFollowRequest(request.id),
    onSuccess: () => {
      removeFromRequestsList();
      updateFollowRequestNotification(queryClient, request.id, 'accepted');
    },
  });
  const rejectMutation = useMutation({
    mutationFn: () => rejectFollowRequest(request.id),
    onSuccess: () => {
      removeFromRequestsList();
      updateFollowRequestNotification(queryClient, request.id, 'declined');
    },
  });

  const isPending = acceptMutation.isPending || rejectMutation.isPending;

  return (
    <div className="flex items-center gap-3 border-b border-border p-4">
      <Link href={`/profile/${request.username}`}>
        <Avatar>
          {request.avatarUrl && (
            <AvatarImage src={request.avatarUrl} alt={`${request.username}'s avatar`} />
          )}
          <AvatarFallback>{request.username.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </Link>
      <p className="min-w-0 flex-1 text-[15px]">
        <Link href={`/profile/${request.username}`} className="font-semibold hover:underline">
          {request.username}
        </Link>{' '}
        <span className="text-muted-foreground">requested to follow you</span>
      </p>
      <Button size="sm" disabled={isPending} onClick={() => acceptMutation.mutate()}>
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => rejectMutation.mutate()}
      >
        Decline
      </Button>
    </div>
  );
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

  const followRequestsQuery = useQuery({
    queryKey: queryKeys.followRequests,
    queryFn: getFollowRequests,
  });

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

      {followRequestsQuery.data && followRequestsQuery.data.length > 0 && (
        <div>
          <h2 className="border-b border-border px-4 py-2 text-sm font-semibold text-muted-foreground">
            Follow requests
          </h2>
          <AnimatePresence initial={false}>
            {followRequestsQuery.data.map((request) => (
              <motion.div
                key={request.id}
                layout
                exit={{ opacity: 0, x: 24, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <FollowRequestRow request={request} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {notificationsQuery.isLoading && <RowSkeletonList />}
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
              <span className="text-muted-foreground">
                {describeNotification(notification.type)}
              </span>
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
