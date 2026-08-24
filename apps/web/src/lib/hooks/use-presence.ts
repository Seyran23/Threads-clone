'use client';

import { useEffect, useState } from 'react';

import {
  getSocket,
  PRESENCE_OFFLINE_EVENT,
  PRESENCE_ONLINE_EVENT,
  PRESENCE_SUBSCRIBE_EVENT,
  PRESENCE_UNSUBSCRIBE_EVENT,
  type PresenceEventPayload,
} from '@/lib/socket/socket-client';

export function usePresence(userId: string | undefined): boolean {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const socket = getSocket();
    const handleOnline = (payload: PresenceEventPayload) => {
      if (payload.userId === userId) {
        setIsOnline(true);
      }
    };
    const handleOffline = (payload: PresenceEventPayload) => {
      if (payload.userId === userId) {
        setIsOnline(false);
      }
    };

    socket.on(PRESENCE_ONLINE_EVENT, handleOnline);
    socket.on(PRESENCE_OFFLINE_EVENT, handleOffline);
    socket.emit(PRESENCE_SUBSCRIBE_EVENT, userId);

    return () => {
      socket.emit(PRESENCE_UNSUBSCRIBE_EVENT, userId);
      socket.off(PRESENCE_ONLINE_EVENT, handleOnline);
      socket.off(PRESENCE_OFFLINE_EVENT, handleOffline);
      setIsOnline(false);
    };
  }, [userId]);

  return isOnline;
}
