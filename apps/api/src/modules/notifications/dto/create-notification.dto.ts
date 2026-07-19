import { NotificationType } from '@/generated/prisma';

export class CreateNotificationDto {
  actorId!: string;
  recipientId!: string;
  type!: NotificationType;
  postId?: string;
}
