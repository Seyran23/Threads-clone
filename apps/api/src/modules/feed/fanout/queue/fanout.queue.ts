import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';

import {
  FANOUT_BACKOFF_DELAY_MS,
  FANOUT_JOB_ATTEMPTS,
  FANOUT_QUEUE_NAME,
} from '../fanout.constants';
import { FanoutJobData } from '../interface/fanout-job-data.interface';

@Injectable()
export class FanoutQueue implements OnModuleDestroy {
  private readonly queue: Queue<FanoutJobData>;

  constructor(
    connection: BullMqConnectionService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FanoutQueue.name);
    this.queue = new Queue<FanoutJobData>(FANOUT_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: FANOUT_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: FANOUT_BACKOFF_DELAY_MS },
      },
    });
  }

  async enqueueFanout(postId: string, authorId: string, createdAt: Date): Promise<void> {
    const job = await this.queue.add('fanout-post', {
      postId,
      authorId,
      createdAt: createdAt.toISOString(),
    });
    this.logger.info({ jobId: job.id, postId }, 'Fanout job enqueued');
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
