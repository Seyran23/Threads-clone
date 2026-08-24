import { io, type Socket } from 'socket.io-client';

import type { NotificationType } from '@threads-clone/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const NOTIFICATION_EVENT = 'notification:new';

export const PRESENCE_SUBSCRIBE_EVENT = 'presence:subscribe';
export const PRESENCE_UNSUBSCRIBE_EVENT = 'presence:unsubscribe';
export const PRESENCE_ONLINE_EVENT = 'presence:online';
export const PRESENCE_OFFLINE_EVENT = 'presence:offline';

export interface NotificationEventPayload {
  id: string;
  type: NotificationType;
  actorId: string;
  postId: string | null;
  createdAt: string;
}

export interface PresenceEventPayload {
  userId: string;
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  socket ??= io(API_URL, { withCredentials: true });
  return socket;
}
