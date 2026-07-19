import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { NotificationsRepository } from '../../notifications.repository';
import { NotificationDeliveryQueue } from '../queue/notification-delivery.queue';

import { NotificationSweepService } from './notification-sweep.service';

describe('NotificationSweepService', () => {
  let sweepService: NotificationSweepService;
  let prisma: PrismaService;
  let notificationsRepository: jest.Mocked<NotificationsRepository>;
  let notificationDeliveryQueue: jest.Mocked<NotificationDeliveryQueue>;
  let logger: jest.Mocked<PinoLogger>;

  beforeEach(() => {
    prisma = {} as PrismaService;

    notificationsRepository = {
      findStuckPending: jest.fn(),
    } as unknown as jest.Mocked<NotificationsRepository>;

    notificationDeliveryQueue = {
      enqueueDelivery: jest.fn(),
    } as unknown as jest.Mocked<NotificationDeliveryQueue>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    sweepService = new NotificationSweepService(
      prisma,
      notificationsRepository,
      notificationDeliveryQueue,
      logger,
    );
  });

  it('does nothing when no notifications are stuck', async () => {
    notificationsRepository.findStuckPending.mockResolvedValue([]);

    await sweepService.sweepStuckNotifications();

    expect(notificationDeliveryQueue.enqueueDelivery).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('re-enqueues every stuck notification and logs a warning with the count', async () => {
    notificationsRepository.findStuckPending.mockResolvedValue([
      { id: 'notification-1' } as never,
      { id: 'notification-2' } as never,
    ]);

    await sweepService.sweepStuckNotifications();

    expect(notificationDeliveryQueue.enqueueDelivery).toHaveBeenNthCalledWith(1, 'notification-1');
    expect(notificationDeliveryQueue.enqueueDelivery).toHaveBeenNthCalledWith(2, 'notification-2');
    expect(logger.warn).toHaveBeenCalledWith({ count: 2 }, 'Re-enqueuing stuck notifications');
  });
});
