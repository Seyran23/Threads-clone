import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { GraphSyncOutboxRepository } from '../graph-sync-outbox.repository';
import { GraphSyncQueue } from '../queue/graph-sync.queue';

@Injectable()
export class GraphSyncSweepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graphSyncOutboxRepository: GraphSyncOutboxRepository,
    private readonly graphSyncQueue: GraphSyncQueue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GraphSyncSweepService.name);
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sweepStuckEvents(): Promise<void> {
    const stuck = await this.graphSyncOutboxRepository.findStuckPending(this.prisma);

    if (stuck.length === 0) {
      return;
    }

    this.logger.warn({ count: stuck.length }, 'Re-enqueuing stuck graph-sync events');

    for (const event of stuck) {
      await this.graphSyncQueue.enqueueSyncEvent(event.id);
    }
  }
}
