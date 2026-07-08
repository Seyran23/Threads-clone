import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { FanoutProcessor } from './fanout/processor/fanout.processor';
import { FanoutQueue } from './fanout/queue/fanout.queue';
import { FanoutSweepService } from './fanout/sweep/fanout-sweep.service';
import { FeedController } from './feed.controller';
import { FeedRepository } from './feed.repository';
import { FeedService } from './feed.service';

@Module({
  controllers: [FeedController],
  providers: [
    FeedRepository,
    FeedService,
    FanoutQueue,
    FanoutProcessor,
    FanoutSweepService,
    JwtAuthGuard,
  ],
  exports: [FeedRepository, FanoutQueue],
})
export class FeedModule {}
