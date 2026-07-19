import { NotificationResponse } from './notification.response';

export class NotificationsPageResponse {
  items!: NotificationResponse[];
  nextCursor!: string | null;
}
