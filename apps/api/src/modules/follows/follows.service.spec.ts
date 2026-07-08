import { PinoLogger } from 'nestjs-pino';

import { ConflictException, NotFoundException } from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { UsersService } from '@/modules/users/users.service';

import { FollowsRepository } from './follows.repository';
import { FollowsService } from './follows.service';
import { GraphSyncOutboxRepository } from './graph-sync/graph-sync-outbox.repository';
import { GraphSyncQueue } from './graph-sync/queue/graph-sync.queue';

describe('FollowsService', () => {
  let followsService: FollowsService;
  let prisma: jest.Mocked<PrismaService>;
  let followsRepository: jest.Mocked<FollowsRepository>;
  let graphSyncOutboxRepository: jest.Mocked<GraphSyncOutboxRepository>;
  let graphSyncQueue: jest.Mocked<GraphSyncQueue>;
  let usersService: jest.Mocked<UsersService>;
  let logger: jest.Mocked<PinoLogger>;

  const tx = {} as never;
  const followee = {
    id: 'user-2',
    email: 'b@example.com',
    username: 'b',
    passwordHash: 'x',
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

    graphSyncOutboxRepository = {
      create: jest.fn(),
    } as unknown as jest.Mocked<GraphSyncOutboxRepository>;

    graphSyncQueue = {
      enqueueSyncEvent: jest.fn(),
    } as unknown as jest.Mocked<GraphSyncQueue>;

    usersService = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    followsService = new FollowsService(
      prisma,
      followsRepository,
      graphSyncOutboxRepository,
      graphSyncQueue,
      usersService,
      logger,
    );

    usersService.findById.mockResolvedValue(followee as never);
    followsRepository.findOne.mockResolvedValue(null);
    graphSyncOutboxRepository.create.mockResolvedValue({
      id: 'outbox-1',
      eventType: 'FOLLOW_CREATED',
      payload: {},
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
      expect(result).toEqual({ following: true });
    });
  });

  describe('unfollowUser', () => {
    it('is a no-op when not currently following', async () => {
      const result = await followsService.unfollowUser('user-1', 'user-2');

      expect(followsRepository.delete).not.toHaveBeenCalled();
      expect(graphSyncOutboxRepository.create).not.toHaveBeenCalled();
      expect(graphSyncQueue.enqueueSyncEvent).not.toHaveBeenCalled();
      expect(result).toEqual({ following: false });
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
      expect(result).toEqual({ following: false });
    });
  });
});
