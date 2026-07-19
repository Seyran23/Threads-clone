import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { NotificationsRepository } from './notifications.repository';
import { NotificationResponse } from './response/notification.response';
import { NotificationsPageResponse } from './response/notifications-page.response';
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
} from './utils/notification-cursor.util';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  async getNotifications(
    recipientId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<NotificationsPageResponse> {
    const beforeMs = decodeNotificationCursor(cursor);

    const notifications = await this.notificationsRepository.findByRecipient(
      this.prisma,
      recipientId,
      beforeMs,
      limit,
    );

    const items = notifications.map((notification) => NotificationResponse.from(notification));
    const nextCursor =
      notifications.length === limit
        ? encodeNotificationCursor(notifications[notifications.length - 1].createdAt.getTime())
        : null;

    return { items, nextCursor };
  }
}
