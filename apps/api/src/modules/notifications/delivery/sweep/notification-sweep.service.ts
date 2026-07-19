import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { NotificationsRepository } from '../../notifications.repository';
import { NotificationDeliveryQueue } from '../queue/notification-delivery.queue';

@Injectable()
export class NotificationSweepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly notificationDeliveryQueue: NotificationDeliveryQueue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(NotificationSweepService.name);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sweepStuckNotifications(): Promise<void> {
    const stuck = await this.notificationsRepository.findStuckPending(this.prisma);

    if (stuck.length === 0) {
      return;
    }

    this.logger.warn({ count: stuck.length }, 'Re-enqueuing stuck notifications');
    for (const notification of stuck) {
      await this.notificationDeliveryQueue.enqueueDelivery(notification.id);
    }
  }
}
