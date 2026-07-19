import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { encodeNotificationCursor } from './utils/notification-cursor.util';

describe('NotificationsService', () => {
  let notificationsService: NotificationsService;
  let prisma: PrismaService;
  let notificationsRepository: jest.Mocked<NotificationsRepository>;

  const actor = {
    id: 'actor-1',
    email: 'a@example.com',
    username: 'a',
    passwordHash: 'x',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const makeNotification = (id: string, createdAt: Date) => ({
    id,
    recipientId: 'user-1',
    actorId: 'actor-1',
    type: 'LIKE',
    postId: 'post-1',
    status: 'DELIVERED',
    attempts: 0,
    createdAt,
    updatedAt: createdAt,
    actor,
  });

  beforeEach(() => {
    prisma = {} as PrismaService;

    notificationsRepository = {
      findByRecipient: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<NotificationsRepository>;

    notificationsService = new NotificationsService(prisma, notificationsRepository);
  });

  it('returns hydrated notifications for the recipient', async () => {
    const createdAt = new Date('2026-07-16T10:00:00.000Z');
    notificationsRepository.findByRecipient.mockResolvedValue([
      makeNotification('notification-1', createdAt),
    ] as never);

    const result = await notificationsService.getNotifications('user-1', undefined, 20);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('notification-1');
    expect(result.items[0].actor.id).toBe('actor-1');
  });

  it('decodes the incoming cursor and passes it down', async () => {
    const cursor = encodeNotificationCursor(1500);

    await notificationsService.getNotifications('user-1', cursor, 20);

    expect(notificationsRepository.findByRecipient).toHaveBeenCalledWith(
      prisma,
      'user-1',
      1500,
      20,
    );
  });

  it('returns a nextCursor when a full page came back', async () => {
    const createdAt = new Date('2026-07-16T10:00:00.000Z');
    notificationsRepository.findByRecipient.mockResolvedValue([
      makeNotification('notification-1', createdAt),
    ] as never);

    const result = await notificationsService.getNotifications('user-1', undefined, 1);

    expect(result.nextCursor).toBe(encodeNotificationCursor(createdAt.getTime()));
  });

  it('returns a null nextCursor when fewer than a full page came back', async () => {
    notificationsRepository.findByRecipient.mockResolvedValue([
      makeNotification('notification-1', new Date()),
    ] as never);

    const result = await notificationsService.getNotifications('user-1', undefined, 20);

    expect(result.nextCursor).toBeNull();
  });
});
