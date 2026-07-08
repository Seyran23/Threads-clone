import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { GraphSyncOutboxRepository } from '../graph-sync-outbox.repository';
import { GraphSyncQueue } from '../queue/graph-sync.queue';

import { GraphSyncSweepService } from './graph-sync-sweep.service';

describe('GraphSyncSweepService', () => {
  let sweepService: GraphSyncSweepService;
  let prisma: PrismaService;
  let graphSyncOutboxRepository: jest.Mocked<GraphSyncOutboxRepository>;
  let graphSyncQueue: jest.Mocked<GraphSyncQueue>;
  let logger: jest.Mocked<PinoLogger>;

  beforeEach(() => {
    prisma = {} as PrismaService;

    graphSyncOutboxRepository = {
      findStuckPending: jest.fn(),
    } as unknown as jest.Mocked<GraphSyncOutboxRepository>;

    graphSyncQueue = {
      enqueueSyncEvent: jest.fn(),
    } as unknown as jest.Mocked<GraphSyncQueue>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    sweepService = new GraphSyncSweepService(
      prisma,
      graphSyncOutboxRepository,
      graphSyncQueue,
      logger,
    );
  });

  it('does nothing when no events are stuck', async () => {
    graphSyncOutboxRepository.findStuckPending.mockResolvedValue([]);

    await sweepService.sweepStuckEvents();

    expect(graphSyncQueue.enqueueSyncEvent).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('re-enqueues every stuck event and logs a warning with the count', async () => {
    graphSyncOutboxRepository.findStuckPending.mockResolvedValue([
      { id: 'outbox-1' } as never,
      { id: 'outbox-2' } as never,
    ]);

    await sweepService.sweepStuckEvents();

    expect(graphSyncQueue.enqueueSyncEvent).toHaveBeenNthCalledWith(1, 'outbox-1');
    expect(graphSyncQueue.enqueueSyncEvent).toHaveBeenNthCalledWith(2, 'outbox-2');
    expect(logger.warn).toHaveBeenCalledWith({ count: 2 }, 'Re-enqueuing stuck graph-sync events');
  });
});
