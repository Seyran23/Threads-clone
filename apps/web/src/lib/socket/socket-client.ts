import { io, type Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const NOTIFICATION_EVENT = 'notification:new';

let socket: Socket | null = null;

export function getSocket(): Socket {
  socket ??= io(API_URL, { withCredentials: true });
  return socket;
}
