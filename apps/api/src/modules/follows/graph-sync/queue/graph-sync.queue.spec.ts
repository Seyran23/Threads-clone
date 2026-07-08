import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';

import {
  GRAPH_SYNC_BACKOFF_DELAY_MS,
  GRAPH_SYNC_JOB_ATTEMPTS,
  GRAPH_SYNC_QUEUE_NAME,
} from '../graph-sync.constants';

import { GraphSyncQueue } from './graph-sync.queue';

jest.mock('bullmq');

describe('GraphSyncQueue', () => {
  let graphSyncQueue: GraphSyncQueue;
  let mockAdd: jest.Mock;
  let logger: jest.Mocked<PinoLogger>;
  const connection = {} as BullMqConnectionService;

  beforeEach(() => {
    mockAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
    jest.mocked(Queue).mockImplementation(
      () =>
        ({
          add: mockAdd,
          close: jest.fn(),
        }) as unknown as Queue,
    );

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    graphSyncQueue = new GraphSyncQueue(connection, logger);
  });

  it('constructs the queue with the right name, connection, and retry policy', () => {
    expect(Queue).toHaveBeenCalledWith(GRAPH_SYNC_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: GRAPH_SYNC_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: GRAPH_SYNC_BACKOFF_DELAY_MS },
      },
    });
  });

  it('enqueues a job with the given outboxId', async () => {
    await graphSyncQueue.enqueueSyncEvent('outbox-1');

    expect(mockAdd).toHaveBeenCalledWith('sync-event', { outboxId: 'outbox-1' });
  });

  it('logs the enqueued job id and outboxId', async () => {
    await graphSyncQueue.enqueueSyncEvent('outbox-1');

    expect(logger.info).toHaveBeenCalledWith(
      { jobId: 'job-1', outboxId: 'outbox-1' },
      'Graph-sync job enqueued',
    );
  });
});
