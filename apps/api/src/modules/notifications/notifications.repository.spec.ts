import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

import { NotificationsRepository } from './notifications.repository';

describe('NotificationsRepository', () => {
  let notificationsRepository: NotificationsRepository;
  let tx: jest.Mocked<PrismaClientOrTx>;

  beforeEach(() => {
    tx = {
      notification: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClientOrTx>;

    notificationsRepository = new NotificationsRepository();
  });

  describe('createIfNotSelf', () => {
    it('creates a notification when actor and recipient differ', async () => {
      await notificationsRepository.createIfNotSelf(tx, {
        actorId: 'user-1',
        recipientId: 'user-2',
        type: 'LIKE',
        postId: 'post-1',
      });

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: { actorId: 'user-1', recipientId: 'user-2', type: 'LIKE', postId: 'post-1' },
      });
    });

    it('skips creation and returns null for a self-action', async () => {
      const result = await notificationsRepository.createIfNotSelf(tx, {
        actorId: 'user-1',
        recipientId: 'user-1',
        type: 'LIKE',
        postId: 'post-1',
      });

      expect(tx.notification.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('markDelivered', () => {
    it('sets status to DELIVERED', async () => {
      await notificationsRepository.markDelivered(tx, 'notification-1');

      expect(tx.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: { status: 'DELIVERED' },
      });
    });
  });

  describe('markSkipped', () => {
    it('sets status to SKIPPED', async () => {
      await notificationsRepository.markSkipped(tx, 'notification-1');

      expect(tx.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: { status: 'SKIPPED' },
      });
    });
  });

  describe('incrementAttempts', () => {
    it('increments attempts and stays PENDING under the max', async () => {
      (tx.notification.update as jest.Mock).mockResolvedValue({
        id: 'notification-1',
        attempts: 2,
        status: 'PENDING',
      });

      const result = await notificationsRepository.incrementAttempts(tx, 'notification-1');

      expect(tx.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: { attempts: { increment: 1 } },
      });
      expect(result).toEqual({ id: 'notification-1', attempts: 2, status: 'PENDING' });
    });

    it('marks FAILED once attempts reaches the max', async () => {
      (tx.notification.update as jest.Mock)
        .mockResolvedValueOnce({ id: 'notification-1', attempts: 5, status: 'PENDING' })
        .mockResolvedValueOnce({ id: 'notification-1', attempts: 5, status: 'FAILED' });

      const result = await notificationsRepository.incrementAttempts(tx, 'notification-1');

      expect(tx.notification.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'notification-1' },
        data: { status: 'FAILED' },
      });
      expect(result.status).toBe('FAILED');
    });
  });

  describe('findStuckPending', () => {
    it('queries PENDING notifications older than the stuck threshold', async () => {
      await notificationsRepository.findStuckPending(tx);

      expect(tx.notification.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING', updatedAt: { lt: expect.any(Date) } },
      });
    });
  });

  describe('findByRecipient', () => {
    it('queries notifications for the recipient, newest first, capped at limit', async () => {
      await notificationsRepository.findByRecipient(tx, 'user-1', undefined, 20);

      expect(tx.notification.findMany).toHaveBeenCalledWith({
        where: { recipientId: 'user-1' },
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });

    it('filters by createdAt strictly before the cursor when one is given', async () => {
      await notificationsRepository.findByRecipient(tx, 'user-1', 1500, 20);

      expect(tx.notification.findMany).toHaveBeenCalledWith({
        where: { recipientId: 'user-1', createdAt: { lt: new Date(1500) } },
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });
  });
});
