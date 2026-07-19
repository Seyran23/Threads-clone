import { Notification, NotificationStatus, NotificationType, User } from '@/generated/prisma';
import { UserResponse } from '@/modules/users/response/user.response';

export type NotificationWithRelations = Notification & { actor: User };

export class NotificationResponse {
  id!: string;
  type!: NotificationType;
  actor!: UserResponse;
  postId!: string | null;
  status!: NotificationStatus;
  createdAt!: Date;

  static from(notification: NotificationWithRelations): NotificationResponse {
    return {
      id: notification.id,
      type: notification.type,
      actor: UserResponse.from(notification.actor),
      postId: notification.postId,
      status: notification.status,
      createdAt: notification.createdAt,
    };
  }
}
