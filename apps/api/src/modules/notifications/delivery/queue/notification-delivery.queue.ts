import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';

import { NotificationDeliveryJobData } from '../interface/notification-delivery-job-data.interface';
import {
  NOTIFICATION_DELIVERY_BACKOFF_DELAY_MS,
  NOTIFICATION_DELIVERY_JOB_ATTEMPTS,
  NOTIFICATION_DELIVERY_QUEUE_NAME,
} from '../notification-delivery.constants';

@Injectable()
export class NotificationDeliveryQueue implements OnModuleDestroy {
  private readonly queue: Queue<NotificationDeliveryJobData>;

  constructor(
    connection: BullMqConnectionService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(NotificationDeliveryQueue.name);
    this.queue = new Queue<NotificationDeliveryJobData>(NOTIFICATION_DELIVERY_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: NOTIFICATION_DELIVERY_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: NOTIFICATION_DELIVERY_BACKOFF_DELAY_MS },
      },
    });
  }

  async enqueueDelivery(notificationId: string): Promise<void> {
    const job = await this.queue.add('deliver-notification', { notificationId });
    this.logger.info({ jobId: job.id, notificationId }, 'Notification delivery job enqueued');
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
