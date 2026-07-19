import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { UsersModule } from '@/modules/users/users.module';

import { FollowsController } from './follows.controller';
import { FollowsRepository } from './follows.repository';
import { FollowsService } from './follows.service';
import { GraphSyncOutboxRepository } from './graph-sync/graph-sync-outbox.repository';
import { GraphSyncProcessor } from './graph-sync/processor/graph-sync.processor';
import { GraphSyncQueue } from './graph-sync/queue/graph-sync.queue';
import { GraphSyncSweepService } from './graph-sync/sweep/graph-sync-sweep.service';

@Module({
  imports: [UsersModule, NotificationsModule],
  controllers: [FollowsController],
  providers: [
    FollowsService,
    FollowsRepository,
    GraphSyncOutboxRepository,
    GraphSyncQueue,
    GraphSyncProcessor,
    GraphSyncSweepService,
    JwtAuthGuard,
  ],
})
export class FollowsModule {}
