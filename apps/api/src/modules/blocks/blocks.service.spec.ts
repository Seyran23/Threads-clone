import { PinoLogger } from 'nestjs-pino';

import { ConflictException, NotFoundException } from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { FollowsService } from '@/modules/follows/follows.service';
import { UsersService } from '@/modules/users/users.service';

import { BlocksRepository } from './blocks.repository';
import { BlocksService } from './blocks.service';

describe('BlocksService', () => {
  let blocksService: BlocksService;
  let prisma: PrismaService;
  let blocksRepository: jest.Mocked<BlocksRepository>;
  let usersService: jest.Mocked<UsersService>;
  let followsService: jest.Mocked<FollowsService>;
  let logger: jest.Mocked<PinoLogger>;

  const target = {
    id: 'user-2',
    email: 'b@example.com',
    username: 'b',
    passwordHash: 'x',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {} as PrismaService;

    blocksRepository = {
      create: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      isBlockedEitherDirection: jest.fn(),
      findBlockedUsers: jest.fn(),
    } as unknown as jest.Mocked<BlocksRepository>;

    usersService = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    followsService = {
      unfollowUser: jest.fn(),
    } as unknown as jest.Mocked<FollowsService>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    blocksService = new BlocksService(
      prisma,
      blocksRepository,
      usersService,
      followsService,
      logger,
    );

    usersService.findById.mockResolvedValue(target as never);
    blocksRepository.findOne.mockResolvedValue(null);
  });

  describe('blockUser', () => {
    it('throws ConflictException when blocking yourself', async () => {
      await expect(blocksService.blockUser('user-1', 'user-1')).rejects.toThrow(ConflictException);
      expect(blocksRepository.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the target does not exist', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(blocksService.blockUser('user-1', 'user-2')).rejects.toThrow(NotFoundException);
      expect(blocksRepository.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when already blocked', async () => {
      blocksRepository.findOne.mockResolvedValue({
        id: 'block-1',
        blockerId: 'user-1',
        blockedId: 'user-2',
        createdAt: new Date(),
      });

      await expect(blocksService.blockUser('user-1', 'user-2')).rejects.toThrow(ConflictException);
      expect(blocksRepository.create).not.toHaveBeenCalled();
    });

    it('creates the Block row and unfollows in both directions', async () => {
      const result = await blocksService.blockUser('user-1', 'user-2');

      expect(blocksRepository.create).toHaveBeenCalledWith(prisma, 'user-1', 'user-2');
      expect(followsService.unfollowUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(followsService.unfollowUser).toHaveBeenCalledWith('user-2', 'user-1');
      expect(result).toEqual({ blocked: true });
    });
  });

  describe('unblockUser', () => {
    it('deletes the Block row', async () => {
      const result = await blocksService.unblockUser('user-1', 'user-2');

      expect(blocksRepository.delete).toHaveBeenCalledWith(prisma, 'user-1', 'user-2');
      expect(result).toEqual({ blocked: false });
    });
  });

  describe('getBlockedUsers', () => {
    it('delegates to the repository for the blocker', async () => {
      blocksRepository.findBlockedUsers.mockResolvedValue([
        { id: 'user-2', username: 'b', avatarUrl: null, blockedAt: new Date() },
      ]);

      const result = await blocksService.getBlockedUsers('user-1');

      expect(blocksRepository.findBlockedUsers).toHaveBeenCalledWith(prisma, 'user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('isBlockedEitherDirection', () => {
    it('delegates to the repository', async () => {
      blocksRepository.isBlockedEitherDirection.mockResolvedValue(true);

      const result = await blocksService.isBlockedEitherDirection('user-1', 'user-2');

      expect(blocksRepository.isBlockedEitherDirection).toHaveBeenCalledWith(
        prisma,
        'user-1',
        'user-2',
      );
      expect(result).toBe(true);
    });
  });
});
