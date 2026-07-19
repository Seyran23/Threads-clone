import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';
import { RealtimeGateway } from '@/infrastructure/socket/realtime.gateway';

import { NotificationsRepository } from '../../notifications.repository';
import { NotificationDeliveryJobData } from '../interface/notification-delivery-job-data.interface';
import {
  NOTIFICATION_DELIVERY_QUEUE_NAME,
  NOTIFICATION_EVENT,
} from '../notification-delivery.constants';

@Injectable()
export class NotificationDeliveryProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker<NotificationDeliveryJobData>;

  constructor(
    private readonly connection: BullMqConnectionService,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(NotificationDeliveryProcessor.name);
  }

  onModuleInit(): void {
    this.worker = new Worker<NotificationDeliveryJobData>(
      NOTIFICATION_DELIVERY_QUEUE_NAME,
      (job) => this.processJob(job),
      { connection: this.connection },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, notificationId: job?.data.notificationId, err },
        'Notification delivery job failed',
      );
    });
  }

  async processJob(job: Job<NotificationDeliveryJobData>): Promise<void> {
    const { notificationId } = job.data;

    this.logger.info({ jobId: job.id, notificationId }, 'Notification delivery job picked up');

    const notification = await this.notificationsRepository.findById(this.prisma, notificationId);

    if (notification?.status !== 'PENDING') {
      return;
    }

    try {
      const delivered = await this.realtimeGateway.emitToUser(
        notification.recipientId,
        NOTIFICATION_EVENT,
        {
          id: notification.id,
          type: notification.type,
          actorId: notification.actorId,
          postId: notification.postId,
          createdAt: notification.createdAt,
        },
      );

      if (delivered) {
        await this.notificationsRepository.markDelivered(this.prisma, notificationId);
        this.logger.info({ notificationId }, 'Notification delivered in real time');
      } else {
        await this.notificationsRepository.markSkipped(this.prisma, notificationId);
        this.logger.info({ notificationId }, 'Recipient offline, notification skipped for now');
      }
    } catch (err) {
      await this.notificationsRepository.incrementAttempts(this.prisma, notificationId);
      this.logger.error(
        { notificationId, jobId: job.id, attempt: job.attemptsMade + 1, err },
        'Notification delivery failed',
      );
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
