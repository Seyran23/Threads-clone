import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { NotificationDeliveryProcessor } from './delivery/processor/notification-delivery.processor';
import { NotificationDeliveryQueue } from './delivery/queue/notification-delivery.queue';
import { NotificationSweepService } from './delivery/sweep/notification-sweep.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    NotificationsService,
    NotificationDeliveryQueue,
    NotificationDeliveryProcessor,
    NotificationSweepService,
    JwtAuthGuard,
  ],
  exports: [NotificationsRepository, NotificationDeliveryQueue],
})
export class NotificationsModule {}
