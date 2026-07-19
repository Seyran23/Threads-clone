import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';
import { RealtimeGateway } from '@/infrastructure/socket/realtime.gateway';

import { FeedRepository } from '../../feed.repository';
import {
  FANOUT_QUEUE_NAME,
  FEED_NEW_POST_EVENT,
  HYBRID_FANOUT_FOLLOWER_THRESHOLD,
} from '../fanout.constants';
import { FanoutJobData } from '../interface/fanout-job-data.interface';

@Injectable()
export class FanoutProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker<FanoutJobData>;

  constructor(
    private readonly connection: BullMqConnectionService,
    private readonly feedRepository: FeedRepository,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FanoutProcessor.name);
  }

  onModuleInit(): void {
    this.worker = new Worker<FanoutJobData>(FANOUT_QUEUE_NAME, (job) => this.processJob(job), {
      connection: this.connection,
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error({ jobId: job?.id, postId: job?.data.postId, err }, 'Fanout job failed');
    });
  }

  async processJob(job: Job<FanoutJobData>): Promise<void> {
    const { postId, authorId, createdAt } = job.data;
    this.logger.info({ jobId: job.id, postId }, 'Fanout job picked up');

    try {
      const followerCount = await this.feedRepository.countFollowers(this.prisma, authorId);

      if (followerCount > HYBRID_FANOUT_FOLLOWER_THRESHOLD) {
        this.logger.info(
          { postId, authorId, followerCount },
          'Skipping fanout for high-follower account; will merge at read time',
        );
      } else {
        const followerIds = await this.feedRepository.findFollowerIds(this.prisma, authorId);
        const recipientIds = [...followerIds, authorId];
        const score = new Date(createdAt).getTime();

        await Promise.all(
          recipientIds.map(async (recipientId) => {
            await this.feedRepository.pushToFeed(recipientId, postId, score);
            await this.realtimeGateway.emitToUser(recipientId, FEED_NEW_POST_EVENT, {
              postId,
              authorId,
              createdAt,
            });
          }),
        );
        this.logger.info(
          { postId, recipientCount: recipientIds.length },
          'Fanned out to followers',
        );
      }

      await this.feedRepository.markFanoutCompleted(this.prisma, postId);
    } catch (err) {
      this.logger.error(
        { postId, jobId: job.id, attempt: job.attemptsMade + 1, err },
        'Fanout failed',
      );
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
