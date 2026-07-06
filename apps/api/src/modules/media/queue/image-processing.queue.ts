import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';

import {
  IMAGE_PROCESSING_BACKOFF_DELAY_MS,
  IMAGE_PROCESSING_JOB_ATTEMPTS,
  IMAGE_PROCESSING_QUEUE_NAME,
} from '../constants/media.constants';

import { ThumbnailJobData } from './thumbnail-job-data.interface';

@Injectable()
export class ImageProcessingQueue implements OnModuleDestroy {
  private readonly queue: Queue<ThumbnailJobData>;

  constructor(
    connection: BullMqConnectionService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ImageProcessingQueue.name);
    this.queue = new Queue<ThumbnailJobData>(IMAGE_PROCESSING_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: IMAGE_PROCESSING_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: IMAGE_PROCESSING_BACKOFF_DELAY_MS },
      },
    });
  }

  async enqueueThumbnailJob(mediaId: string): Promise<void> {
    const job = await this.queue.add('generate-thumbnail', { mediaId });
    this.logger.info({ jobId: job.id, mediaId }, 'Thumbnail job enqueued');
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
