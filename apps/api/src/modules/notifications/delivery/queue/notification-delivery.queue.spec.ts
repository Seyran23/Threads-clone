import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';

import {
  NOTIFICATION_DELIVERY_BACKOFF_DELAY_MS,
  NOTIFICATION_DELIVERY_JOB_ATTEMPTS,
  NOTIFICATION_DELIVERY_QUEUE_NAME,
} from '../notification-delivery.constants';

import { NotificationDeliveryQueue } from './notification-delivery.queue';

jest.mock('bullmq');

describe('NotificationDeliveryQueue', () => {
  let notificationDeliveryQueue: NotificationDeliveryQueue;
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

    notificationDeliveryQueue = new NotificationDeliveryQueue(connection, logger);
  });

  it('constructs the queue with the right name, connection, and retry policy', () => {
    expect(Queue).toHaveBeenCalledWith(NOTIFICATION_DELIVERY_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: NOTIFICATION_DELIVERY_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: NOTIFICATION_DELIVERY_BACKOFF_DELAY_MS },
      },
    });
  });

  it('enqueues a job with the given notificationId', async () => {
    await notificationDeliveryQueue.enqueueDelivery('notification-1');

    expect(mockAdd).toHaveBeenCalledWith('deliver-notification', {
      notificationId: 'notification-1',
    });
  });

  it('logs the enqueued job id and notificationId', async () => {
    await notificationDeliveryQueue.enqueueDelivery('notification-1');

    expect(logger.info).toHaveBeenCalledWith(
      { jobId: 'job-1', notificationId: 'notification-1' },
      'Notification delivery job enqueued',
    );
  });
});
