'use client';

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { queryKeys } from '@/lib/query-keys';
import {
  getSocket,
  NOTIFICATION_EVENT,
  type NotificationEventPayload,
} from '@/lib/socket/socket-client';
import { describeNotification, TOASTABLE_TYPES } from '@/lib/utils/notification-text';

export function useNotificationSocket(enabled: boolean): void {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const socket = getSocket();
    const handleNewNotification = (payload: NotificationEventPayload) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.setQueryData(queryKeys.hasNewNotification, true);

      if (TOASTABLE_TYPES.includes(payload.type)) {
        toast(describeNotification(payload.type), {
          action: {
            label: 'View',
            onClick: () => router.push(payload.postId ? `/post/${payload.postId}` : '/activity'),
          },
        });
      }
    };

    socket.on(NOTIFICATION_EVENT, handleNewNotification);
    return () => {
      socket.off(NOTIFICATION_EVENT, handleNewNotification);
    };
  }, [enabled, queryClient, router]);
}

export function useHasNewNotification(): boolean {
  const { data } = useQuery({
    queryKey: queryKeys.hasNewNotification,
    queryFn: () => false,
    initialData: false,
    staleTime: Infinity,
  });
  return data;
}

export function clearNewNotificationBadge(queryClient: QueryClient): void {
  queryClient.setQueryData(queryKeys.hasNewNotification, false);
}
