import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';

import {
  IMAGE_PROCESSING_BACKOFF_DELAY_MS,
  IMAGE_PROCESSING_JOB_ATTEMPTS,
  IMAGE_PROCESSING_QUEUE_NAME,
} from '../constants/media.constants';

import { ImageProcessingQueue } from './image-processing.queue';

jest.mock('bullmq');

describe('ImageProcessingQueue', () => {
  let imageProcessingQueue: ImageProcessingQueue;
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
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    imageProcessingQueue = new ImageProcessingQueue(connection, logger);
  });

  it('constructs the queue with the right name, connection, and retry policy', () => {
    expect(Queue).toHaveBeenCalledWith(IMAGE_PROCESSING_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: IMAGE_PROCESSING_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: IMAGE_PROCESSING_BACKOFF_DELAY_MS },
      },
    });
  });

  it('enqueues a job with the given mediaId', async () => {
    await imageProcessingQueue.enqueueThumbnailJob('media-1');

    expect(mockAdd).toHaveBeenCalledWith('generate-thumbnail', { mediaId: 'media-1' });
  });

  it('logs the enqueued job id and mediaId', async () => {
    await imageProcessingQueue.enqueueThumbnailJob('media-1');

    expect(logger.info).toHaveBeenCalledWith(
      { jobId: 'job-1', mediaId: 'media-1' },
      'Thumbnail job enqueued',
    );
  });
});
