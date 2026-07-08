import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';

import {
  FANOUT_BACKOFF_DELAY_MS,
  FANOUT_JOB_ATTEMPTS,
  FANOUT_QUEUE_NAME,
} from '../fanout.constants';

import { FanoutQueue } from './fanout.queue';

jest.mock('bullmq');

describe('FanoutQueue', () => {
  let fanoutQueue: FanoutQueue;
  let mockAdd: jest.Mock;
  let logger: jest.Mocked<PinoLogger>;
  const connection = {} as BullMqConnectionService;
  const createdAt = new Date('2026-07-08T12:00:00.000Z');

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

    fanoutQueue = new FanoutQueue(connection, logger);
  });

  it('constructs the queue with the right name, connection, and retry policy', () => {
    expect(Queue).toHaveBeenCalledWith(FANOUT_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: FANOUT_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: FANOUT_BACKOFF_DELAY_MS },
      },
    });
  });

  it('enqueues a job with postId, authorId, and an ISO-serialized createdAt', async () => {
    await fanoutQueue.enqueueFanout('post-1', 'author-1', createdAt);

    expect(mockAdd).toHaveBeenCalledWith('fanout-post', {
      postId: 'post-1',
      authorId: 'author-1',
      createdAt: createdAt.toISOString(),
    });
  });

  it('logs the enqueued job id and postId', async () => {
    await fanoutQueue.enqueueFanout('post-1', 'author-1', createdAt);

    expect(logger.info).toHaveBeenCalledWith(
      { jobId: 'job-1', postId: 'post-1' },
      'Fanout job enqueued',
    );
  });
});
