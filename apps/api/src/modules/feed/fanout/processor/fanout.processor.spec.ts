import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';
import { RealtimeGateway } from '@/infrastructure/socket/realtime.gateway';

import { FeedRepository } from '../../feed.repository';
import { FEED_NEW_POST_EVENT, HYBRID_FANOUT_FOLLOWER_THRESHOLD } from '../fanout.constants';
import { FanoutJobData } from '../interface/fanout-job-data.interface';

import { FanoutProcessor } from './fanout.processor';

jest.mock('bullmq', () => ({
  ...jest.requireActual('bullmq'),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn() })),
}));

describe('FanoutProcessor', () => {
  let processor: FanoutProcessor;
  let feedRepository: jest.Mocked<FeedRepository>;
  let realtimeGateway: jest.Mocked<RealtimeGateway>;
  let prisma: PrismaService;
  let logger: jest.Mocked<PinoLogger>;

  const job = {
    id: 'job-1',
    data: { postId: 'post-1', authorId: 'author-1', createdAt: '2026-07-08T12:00:00.000Z' },
    attemptsMade: 0,
  } as Job<FanoutJobData>;

  beforeEach(() => {
    feedRepository = {
      countFollowers: jest.fn().mockResolvedValue(2),
      findFollowerIds: jest.fn().mockResolvedValue(['follower-1', 'follower-2']),
      pushToFeed: jest.fn(),
      markFanoutCompleted: jest.fn(),
    } as unknown as jest.Mocked<FeedRepository>;

    realtimeGateway = {
      emitToUser: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<RealtimeGateway>;

    prisma = {} as PrismaService;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    processor = new FanoutProcessor(
      {} as BullMqConnectionService,
      feedRepository,
      realtimeGateway,
      prisma,
      logger,
    );
  });

  it('pushes the post to every follower feed and the author own feed, then marks fanout completed', async () => {
    await processor.processJob(job);

    expect(feedRepository.pushToFeed).toHaveBeenCalledWith(
      'follower-1',
      'post-1',
      new Date(job.data.createdAt).getTime(),
    );
    expect(feedRepository.pushToFeed).toHaveBeenCalledWith(
      'follower-2',
      'post-1',
      new Date(job.data.createdAt).getTime(),
    );
    expect(feedRepository.pushToFeed).toHaveBeenCalledWith(
      'author-1',
      'post-1',
      new Date(job.data.createdAt).getTime(),
    );
    expect(feedRepository.pushToFeed).toHaveBeenCalledTimes(3);
    expect(feedRepository.markFanoutCompleted).toHaveBeenCalledWith(prisma, 'post-1');
  });

  it('emits a best-effort feed:new-post event to every recipient', async () => {
    await processor.processJob(job);

    expect(realtimeGateway.emitToUser).toHaveBeenCalledWith('follower-1', FEED_NEW_POST_EVENT, {
      postId: 'post-1',
      authorId: 'author-1',
      createdAt: job.data.createdAt,
    });
    expect(realtimeGateway.emitToUser).toHaveBeenCalledWith('author-1', FEED_NEW_POST_EVENT, {
      postId: 'post-1',
      authorId: 'author-1',
      createdAt: job.data.createdAt,
    });
    expect(realtimeGateway.emitToUser).toHaveBeenCalledTimes(3);
  });

  it('skips pushing to feeds for accounts over the hybrid follower threshold, but still marks completed', async () => {
    feedRepository.countFollowers.mockResolvedValue(HYBRID_FANOUT_FOLLOWER_THRESHOLD + 1);

    await processor.processJob(job);

    expect(feedRepository.findFollowerIds).not.toHaveBeenCalled();
    expect(feedRepository.pushToFeed).not.toHaveBeenCalled();
    expect(feedRepository.markFanoutCompleted).toHaveBeenCalledWith(prisma, 'post-1');
  });

  it('rethrows and does not mark completed when a push fails, so BullMQ retries it', async () => {
    feedRepository.pushToFeed.mockRejectedValueOnce(new Error('Redis unreachable'));

    await expect(processor.processJob(job)).rejects.toThrow('Redis unreachable');

    expect(feedRepository.markFanoutCompleted).not.toHaveBeenCalled();
  });
});
