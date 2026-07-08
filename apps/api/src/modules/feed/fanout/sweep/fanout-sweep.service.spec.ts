import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { FeedRepository } from '../../feed.repository';
import { FanoutQueue } from '../queue/fanout.queue';

import { FanoutSweepService } from './fanout-sweep.service';

describe('FanoutSweepService', () => {
  let sweepService: FanoutSweepService;
  let prisma: PrismaService;
  let feedRepository: jest.Mocked<FeedRepository>;
  let fanoutQueue: jest.Mocked<FanoutQueue>;
  let logger: jest.Mocked<PinoLogger>;

  beforeEach(() => {
    prisma = {} as PrismaService;

    feedRepository = {
      findStuckPendingFanout: jest.fn(),
    } as unknown as jest.Mocked<FeedRepository>;

    fanoutQueue = {
      enqueueFanout: jest.fn(),
    } as unknown as jest.Mocked<FanoutQueue>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    sweepService = new FanoutSweepService(prisma, feedRepository, fanoutQueue, logger);
  });

  it('does nothing when no posts are stuck', async () => {
    feedRepository.findStuckPendingFanout.mockResolvedValue([]);

    await sweepService.sweepStuckPosts();

    expect(fanoutQueue.enqueueFanout).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('re-enqueues every stuck post and logs a warning with the count', async () => {
    const createdAt1 = new Date('2026-07-08T11:00:00.000Z');
    const createdAt2 = new Date('2026-07-08T11:05:00.000Z');
    feedRepository.findStuckPendingFanout.mockResolvedValue([
      { id: 'post-1', authorId: 'author-1', createdAt: createdAt1 } as never,
      { id: 'post-2', authorId: 'author-2', createdAt: createdAt2 } as never,
    ]);

    await sweepService.sweepStuckPosts();

    expect(fanoutQueue.enqueueFanout).toHaveBeenNthCalledWith(1, 'post-1', 'author-1', createdAt1);
    expect(fanoutQueue.enqueueFanout).toHaveBeenNthCalledWith(2, 'post-2', 'author-2', createdAt2);
    expect(logger.warn).toHaveBeenCalledWith({ count: 2 }, 'Re-enqueuing stuck fanout posts');
  });
});
