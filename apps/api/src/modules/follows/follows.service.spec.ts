import { PinoLogger } from 'nestjs-pino';

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { BlocksService } from '@/modules/blocks/blocks.service';
import { NotificationDeliveryQueue } from '@/modules/notifications/delivery/queue/notification-delivery.queue';
import { NotificationsRepository } from '@/modules/notifications/notifications.repository';
import { UsersService } from '@/modules/users/users.service';

import { FollowRequestsRepository } from './follow-requests.repository';
import { FollowsRepository } from './follows.repository';
import { FollowsService } from './follows.service';
import { GraphSyncOutboxRepository } from './graph-sync/graph-sync-outbox.repository';
import { GraphSyncQueue } from './graph-sync/queue/graph-sync.queue';

describe('FollowsService', () => {
  let followsService: FollowsService;
  let prisma: jest.Mocked<PrismaService>;
  let followsRepository: jest.Mocked<FollowsRepository>;
  let followRequestsRepository: jest.Mocked<FollowRequestsRepository>;
  let graphSyncOutboxRepository: jest.Mocked<GraphSyncOutboxRepository>;
  let graphSyncQueue: jest.Mocked<GraphSyncQueue>;
  let notificationsRepository: jest.Mocked<NotificationsRepository>;
  let notificationDeliveryQueue: jest.Mocked<NotificationDeliveryQueue>;
  let usersService: jest.Mocked<UsersService>;
  let blocksService: jest.Mocked<BlocksService>;
  let logger: jest.Mocked<PinoLogger>;

  const tx = {} as never;
  const followee = {
    id: 'user-2',
    email: 'b@example.com',
    username: 'b',
    passwordHash: 'x',
    isPrivate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    } as unknown as jest.Mocked<PrismaService>;

    followsRepository = {
      create: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<FollowsRepository>;

    followRequestsRepository = {
      create: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      findByTarget: jest.fn(),
    } as unknown as jest.Mocked<FollowRequestsRepository>;

    graphSyncOutboxRepository = {
      create: jest.fn(),
    } as unknown as jest.Mocked<GraphSyncOutboxRepository>;

    graphSyncQueue = {
      enqueueSyncEvent: jest.fn(),
    } as unknown as jest.Mocked<GraphSyncQueue>;

    notificationsRepository = {
      createIfNotSelf: jest.fn(),
    } as unknown as jest.Mocked<NotificationsRepository>;

    notificationDeliveryQueue = {
      enqueueDelivery: jest.fn(),
    } as unknown as jest.Mocked<NotificationDeliveryQueue>;

    usersService = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    blocksService = {
      isBlockedEitherDirection: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<BlocksService>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    followsService = new FollowsService(
      prisma,
      followsRepository,
      followRequestsRepository,
      graphSyncOutboxRepository,
      graphSyncQueue,
      notificationsRepository,
      notificationDeliveryQueue,
      usersService,
      blocksService,
      logger,
    );

    usersService.findById.mockResolvedValue(followee as never);
    followsRepository.findOne.mockResolvedValue(null);
    followRequestsRepository.findOne.mockResolvedValue(null);
    graphSyncOutboxRepository.create.mockResolvedValue({
      id: 'outbox-1',
      eventType: 'FOLLOW_CREATED',
      payload: {},
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    notificationsRepository.createIfNotSelf.mockResolvedValue({
      id: 'notification-1',
      actorId: 'user-1',
      recipientId: 'user-2',
      type: 'FOLLOW',
      postId: null,
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
  });

  describe('followUser', () => {
    it('throws ConflictException when following yourself', async () => {
      await expect(followsService.followUser('user-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
      expect(followsRepository.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the followee does not exist', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(followsService.followUser('user-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
      expect(followsRepository.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when there is a block between the two users', async () => {
      blocksService.isBlockedEitherDirection.mockResolvedValue(true);

      await expect(followsService.followUser('user-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
      expect(followsRepository.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when already following', async () => {
      followsRepository.findOne.mockResolvedValue({
        id: 'follow-1',
        followerId: 'user-1',
        followeeId: 'user-2',
        createdAt: new Date(),
      });

      await expect(followsService.followUser('user-1', 'user-2')).rejects.toThrow(
        ConflictException,
      );
      expect(followsRepository.create).not.toHaveBeenCalled();
    });

    it('creates the Follow row and a FOLLOW_CREATED outbox event in the same transaction', async () => {
      const result = await followsService.followUser('user-1', 'user-2');

      expect(followsRepository.create).toHaveBeenCalledWith(tx, {
        followerId: 'user-1',
        followeeId: 'user-2',
      });
      expect(graphSyncOutboxRepository.create).toHaveBeenCalledWith(tx, {
        eventType: 'FOLLOW_CREATED',
        payload: { followerId: 'user-1', followeeId: 'user-2' },
      });
      expect(graphSyncQueue.enqueueSyncEvent).toHaveBeenCalledWith('outbox-1');
      expect(result).toEqual({ following: true, requested: false });
    });

    it('creates a follow request instead of a Follow row when the followee is private', async () => {
      usersService.findById.mockResolvedValue({ ...followee, isPrivate: true } as never);

      const result = await followsService.followUser('user-1', 'user-2');

      expect(followRequestsRepository.create).toHaveBeenCalledWith(tx, 'user-1', 'user-2');
      expect(followsRepository.create).not.toHaveBeenCalled();
      expect(notificationsRepository.createIfNotSelf).toHaveBeenCalledWith(tx, {
        actorId: 'user-1',
        recipientId: 'user-2',
        type: 'FOLLOW_REQUEST',
      });
      expect(result).toEqual({ following: false, requested: true });
    });

    it('throws ConflictException when a follow request is already pending', async () => {
      usersService.findById.mockResolvedValue({ ...followee, isPrivate: true } as never);
      followRequestsRepository.findOne.mockResolvedValue({
        id: 'request-1',
        requesterId: 'user-1',
        targetId: 'user-2',
        createdAt: new Date(),
      });

      await expect(followsService.followUser('user-1', 'user-2')).rejects.toThrow(
        ConflictException,
      );
      expect(followRequestsRepository.create).not.toHaveBeenCalled();
    });

    it('creates a FOLLOW notification and enqueues its delivery', async () => {
      await followsService.followUser('user-1', 'user-2');

      expect(notificationsRepository.createIfNotSelf).toHaveBeenCalledWith(tx, {
        actorId: 'user-1',
        recipientId: 'user-2',
        type: 'FOLLOW',
      });
      expect(notificationDeliveryQueue.enqueueDelivery).toHaveBeenCalledWith('notification-1');
    });

    it('does not enqueue delivery when no notification was created (self-action guard)', async () => {
      notificationsRepository.createIfNotSelf.mockResolvedValue(null);

      await followsService.followUser('user-1', 'user-2');

      expect(notificationDeliveryQueue.enqueueDelivery).not.toHaveBeenCalled();
    });
  });

  describe('unfollowUser', () => {
    it('is a no-op when not currently following and no request is pending', async () => {
      const result = await followsService.unfollowUser('user-1', 'user-2');

      expect(followsRepository.delete).not.toHaveBeenCalled();
      expect(graphSyncOutboxRepository.create).not.toHaveBeenCalled();
      expect(graphSyncQueue.enqueueSyncEvent).not.toHaveBeenCalled();
      expect(result).toEqual({ following: false, requested: false });
    });

    it('cancels a pending follow request when not yet following', async () => {
      const result = await followsService.unfollowUser('user-1', 'user-2');

      expect(followRequestsRepository.delete).toHaveBeenCalledWith(prisma, 'user-1', 'user-2');
      expect(result).toEqual({ following: false, requested: false });
    });

    it('deletes the Follow row and enqueues a FOLLOW_DELETED outbox event when following', async () => {
      followsRepository.findOne.mockResolvedValue({
        id: 'follow-1',
        followerId: 'user-1',
        followeeId: 'user-2',
        createdAt: new Date(),
      });

      const result = await followsService.unfollowUser('user-1', 'user-2');

      expect(followsRepository.delete).toHaveBeenCalledWith(tx, 'user-1', 'user-2');
      expect(graphSyncOutboxRepository.create).toHaveBeenCalledWith(tx, {
        eventType: 'FOLLOW_DELETED',
        payload: { followerId: 'user-1', followeeId: 'user-2' },
      });
      expect(graphSyncQueue.enqueueSyncEvent).toHaveBeenCalledWith('outbox-1');
      expect(result).toEqual({ following: false, requested: false });
    });

    it('does not create a notification for unfollowing', async () => {
      followsRepository.findOne.mockResolvedValue({
        id: 'follow-1',
        followerId: 'user-1',
        followeeId: 'user-2',
        createdAt: new Date(),
      });

      await followsService.unfollowUser('user-1', 'user-2');

      expect(notificationsRepository.createIfNotSelf).not.toHaveBeenCalled();
    });
  });

  describe('listFollowRequests', () => {
    it('delegates to the repository for the target', async () => {
      followRequestsRepository.findByTarget.mockResolvedValue([
        { id: 'user-1', username: 'a', avatarUrl: null, requestedAt: new Date() },
      ]);

      const result = await followsService.listFollowRequests('user-2');

      expect(followRequestsRepository.findByTarget).toHaveBeenCalledWith(prisma, 'user-2');
      expect(result).toHaveLength(1);
    });
  });

  describe('acceptFollowRequest', () => {
    it('throws NotFoundException when there is no pending request', async () => {
      await expect(followsService.acceptFollowRequest('user-2', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(followsRepository.create).not.toHaveBeenCalled();
    });

    it('deletes the request and creates the Follow row and outbox event', async () => {
      followRequestsRepository.findOne.mockResolvedValue({
        id: 'request-1',
        requesterId: 'user-1',
        targetId: 'user-2',
        createdAt: new Date(),
      });

      await followsService.acceptFollowRequest('user-2', 'user-1');

      expect(followRequestsRepository.delete).toHaveBeenCalledWith(tx, 'user-1', 'user-2');
      expect(followsRepository.create).toHaveBeenCalledWith(tx, {
        followerId: 'user-1',
        followeeId: 'user-2',
      });
      expect(graphSyncOutboxRepository.create).toHaveBeenCalledWith(tx, {
        eventType: 'FOLLOW_CREATED',
        payload: { followerId: 'user-1', followeeId: 'user-2' },
      });
      expect(graphSyncQueue.enqueueSyncEvent).toHaveBeenCalledWith('outbox-1');
    });
  });

  describe('rejectFollowRequest', () => {
    it('deletes the pending request', async () => {
      await followsService.rejectFollowRequest('user-2', 'user-1');

      expect(followRequestsRepository.delete).toHaveBeenCalledWith(prisma, 'user-1', 'user-2');
    });
  });
});
