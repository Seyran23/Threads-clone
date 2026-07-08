import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';

import {
  GRAPH_SYNC_BACKOFF_DELAY_MS,
  GRAPH_SYNC_JOB_ATTEMPTS,
  GRAPH_SYNC_QUEUE_NAME,
} from '../graph-sync.constants';
import { GraphSyncJobData } from '../interface/graph-sync-job-data.interface';

@Injectable()
export class GraphSyncQueue implements OnModuleDestroy {
  private readonly queue: Queue<GraphSyncJobData>;

  constructor(
    connection: BullMqConnectionService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GraphSyncQueue.name);
    this.queue = new Queue<GraphSyncJobData>(GRAPH_SYNC_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: GRAPH_SYNC_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: GRAPH_SYNC_BACKOFF_DELAY_MS },
      },
    });
  }

  async enqueueSyncEvent(outboxId: string): Promise<void> {
    const job = await this.queue.add('sync-event', { outboxId });
    this.logger.info({ jobId: job.id, outboxId }, 'Graph-sync job enqueued');
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
