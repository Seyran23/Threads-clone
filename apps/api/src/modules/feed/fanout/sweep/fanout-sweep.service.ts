import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { FeedRepository } from '../../feed.repository';
import { FanoutQueue } from '../queue/fanout.queue';

@Injectable()
export class FanoutSweepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feedRepository: FeedRepository,
    private readonly fanoutQueue: FanoutQueue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FanoutSweepService.name);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sweepStuckPosts(): Promise<void> {
    const stuck = await this.feedRepository.findStuckPendingFanout(this.prisma);

    if (stuck.length === 0) {
      return;
    }

    this.logger.warn({ count: stuck.length }, 'Re-enqueuing stuck fanout posts');
    for (const post of stuck) {
      await this.fanoutQueue.enqueueFanout(post.id, post.authorId, post.createdAt);
    }
  }
}
