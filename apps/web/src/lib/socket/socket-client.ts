import { io, type Socket } from 'socket.io-client';

import type { NotificationType } from '@threads-clone/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const NOTIFICATION_EVENT = 'notification:new';

export interface NotificationEventPayload {
  id: string;
  type: NotificationType;
  actorId: string;
  postId: string | null;
  createdAt: string;
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  socket ??= io(API_URL, { withCredentials: true });
  return socket;
}
