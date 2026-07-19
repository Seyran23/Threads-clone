import { Injectable } from '@nestjs/common';

import { Notification } from '@/generated/prisma';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

import {
  NOTIFICATION_MAX_ATTEMPTS,
  NOTIFICATION_STUCK_THRESHOLD_MS,
} from './delivery/notification-delivery.constants';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationWithRelations } from './response/notification.response';

const NOTIFICATION_INCLUDE = { actor: true } as const;

@Injectable()
export class NotificationsRepository {
  createIfNotSelf(tx: PrismaClientOrTx, data: CreateNotificationDto): Promise<Notification | null> {
    if (data.actorId === data.recipientId) {
      return Promise.resolve(null);
    }

    return tx.notification.create({
      data: {
        actorId: data.actorId,
        recipientId: data.recipientId,
        type: data.type,
        postId: data.postId,
      },
    });
  }

  findById(tx: PrismaClientOrTx, id: string): Promise<Notification | null> {
    return tx.notification.findUnique({ where: { id } });
  }

  markDelivered(tx: PrismaClientOrTx, id: string): Promise<Notification> {
    return tx.notification.update({ where: { id }, data: { status: 'DELIVERED' } });
  }

  markSkipped(tx: PrismaClientOrTx, id: string): Promise<Notification> {
    return tx.notification.update({ where: { id }, data: { status: 'SKIPPED' } });
  }

  async incrementAttempts(tx: PrismaClientOrTx, id: string): Promise<Notification> {
    const updated = await tx.notification.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });

    if (updated.attempts >= NOTIFICATION_MAX_ATTEMPTS) {
      return tx.notification.update({ where: { id }, data: { status: 'FAILED' } });
    }
    return updated;
  }

  findStuckPending(tx: PrismaClientOrTx): Promise<Notification[]> {
    return tx.notification.findMany({
      where: {
        status: 'PENDING',
        updatedAt: { lt: new Date(Date.now() - NOTIFICATION_STUCK_THRESHOLD_MS) },
      },
    });
  }

  findByRecipient(
    tx: PrismaClientOrTx,
    recipientId: string,
    beforeMs: number | undefined,
    limit: number,
  ): Promise<NotificationWithRelations[]> {
    return tx.notification.findMany({
      where: {
        recipientId,
        ...(beforeMs !== undefined ? { createdAt: { lt: new Date(beforeMs) } } : {}),
      },
      include: NOTIFICATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
