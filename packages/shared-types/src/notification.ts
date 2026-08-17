import type { User } from './user';

export type NotificationType = 'LIKE' | 'REPLY' | 'FOLLOW';
export type NotificationStatus = 'PENDING' | 'DELIVERED' | 'FAILED' | 'SKIPPED';

export interface Notification {
  id: string;
  type: NotificationType;
  actor: User;
  postId: string | null;
  status: NotificationStatus;
  createdAt: string;
}

export interface NotificationsPage {
  items: Notification[];
  nextCursor: string | null;
}
