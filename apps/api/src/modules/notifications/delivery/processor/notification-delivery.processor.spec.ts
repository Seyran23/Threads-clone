import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';
import { RealtimeGateway } from '@/infrastructure/socket/realtime.gateway';

import { NotificationsRepository } from '../../notifications.repository';
import { NotificationDeliveryJobData } from '../interface/notification-delivery-job-data.interface';
import { NOTIFICATION_EVENT } from '../notification-delivery.constants';

import { NotificationDeliveryProcessor } from './notification-delivery.processor';

jest.mock('bullmq', () => ({
  ...jest.requireActual('bullmq'),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn() })),
}));

describe('NotificationDeliveryProcessor', () => {
  let processor: NotificationDeliveryProcessor;
  let notificationsRepository: jest.Mocked<NotificationsRepository>;
  let realtimeGateway: jest.Mocked<RealtimeGateway>;
  let prisma: PrismaService;
  let logger: jest.Mocked<PinoLogger>;

  const pendingNotification = {
    id: 'notification-1',
    recipientId: 'user-2',
    actorId: 'user-1',
    type: 'LIKE',
    postId: 'post-1',
    status: 'PENDING',
    attempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const job = {
    id: 'job-1',
    data: { notificationId: 'notification-1' },
    attemptsMade: 0,
  } as Job<NotificationDeliveryJobData>;

  beforeEach(() => {
    notificationsRepository = {
      findById: jest.fn().mockResolvedValue(pendingNotification),
      markDelivered: jest.fn(),
      markSkipped: jest.fn(),
      incrementAttempts: jest.fn(),
    } as unknown as jest.Mocked<NotificationsRepository>;

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

    processor = new NotificationDeliveryProcessor(
      {} as BullMqConnectionService,
      notificationsRepository,
      realtimeGateway,
      prisma,
      logger,
    );
  });

  it('skips when the notification row no longer exists', async () => {
    notificationsRepository.findById.mockResolvedValue(null);

    await processor.processJob(job);

    expect(realtimeGateway.emitToUser).not.toHaveBeenCalled();
  });

  it('skips when the notification is no longer PENDING', async () => {
    notificationsRepository.findById.mockResolvedValue({
      ...pendingNotification,
      status: 'DELIVERED',
    } as never);

    await processor.processJob(job);

    expect(realtimeGateway.emitToUser).not.toHaveBeenCalled();
  });

  it('emits to the recipient and marks DELIVERED when they are connected', async () => {
    realtimeGateway.emitToUser.mockResolvedValue(true);

    await processor.processJob(job);

    expect(realtimeGateway.emitToUser).toHaveBeenCalledWith('user-2', NOTIFICATION_EVENT, {
      id: 'notification-1',
      type: 'LIKE',
      actorId: 'user-1',
      postId: 'post-1',
      createdAt: pendingNotification.createdAt,
    });
    expect(notificationsRepository.markDelivered).toHaveBeenCalledWith(prisma, 'notification-1');
    expect(notificationsRepository.markSkipped).not.toHaveBeenCalled();
  });

  it('marks SKIPPED without throwing when the recipient has no active socket', async () => {
    realtimeGateway.emitToUser.mockResolvedValue(false);

    await processor.processJob(job);

    expect(notificationsRepository.markSkipped).toHaveBeenCalledWith(prisma, 'notification-1');
    expect(notificationsRepository.markDelivered).not.toHaveBeenCalled();
  });

  it('increments attempts and rethrows when delivery throws, so BullMQ retries it', async () => {
    realtimeGateway.emitToUser.mockRejectedValue(new Error('Redis unreachable'));

    await expect(processor.processJob(job)).rejects.toThrow('Redis unreachable');

    expect(notificationsRepository.incrementAttempts).toHaveBeenCalledWith(
      prisma,
      'notification-1',
    );
    expect(notificationsRepository.markDelivered).not.toHaveBeenCalled();
    expect(notificationsRepository.markSkipped).not.toHaveBeenCalled();
  });
});
