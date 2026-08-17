'use client';

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryKeys } from '@/lib/query-keys';
import { getSocket, NOTIFICATION_EVENT } from '@/lib/socket/socket-client';

export function useNotificationSocket(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const socket = getSocket();
    const handleNewNotification = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.setQueryData(queryKeys.hasNewNotification, true);
    };

    socket.on(NOTIFICATION_EVENT, handleNewNotification);
    return () => {
      socket.off(NOTIFICATION_EVENT, handleNewNotification);
    };
  }, [enabled, queryClient]);
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
