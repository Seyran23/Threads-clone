import { PinoLogger } from 'nestjs-pino';

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@/common/exceptions/app.exception';
import { Neo4jService } from '@/infrastructure/neo4j/neo4j.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { S3Service } from '@/infrastructure/s3/s3.service';
import { LikesRepository } from '@/modules/posts/likes.repository';
import { PostsRepository } from '@/modules/posts/posts.repository';
import { SavedPostsRepository } from '@/modules/posts/saved-posts.repository';

import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let usersService: UsersService;
  let usersRepository: jest.Mocked<UsersRepository>;
  let postsRepository: jest.Mocked<PostsRepository>;
  let likesRepository: jest.Mocked<LikesRepository>;
  let savedPostsRepository: jest.Mocked<SavedPostsRepository>;
  let prisma: PrismaService;
  let neo4j: jest.Mocked<Neo4jService>;
  let s3Service: jest.Mocked<S3Service>;
  let logger: jest.Mocked<PinoLogger>;

  const createDto = { email: 'alice@example.com', username: 'alice', passwordHash: 'hash' };
  const user = {
    id: 'user-1',
    ...createDto,
    avatarUrl: null,
    isPrivate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    usersRepository = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      countFollowers: jest.fn(),
      countFollowing: jest.fn(),
      isFollowing: jest.fn(),
      isBlockedEitherDirection: jest.fn().mockResolvedValue(false),
      hasPendingFollowRequest: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<UsersRepository>;

    postsRepository = {
      findByAuthor: jest.fn().mockResolvedValue([]),
      findRepliesByAuthor: jest.fn().mockResolvedValue([]),
      findFollowedAuthorIds: jest.fn().mockResolvedValue(new Set()),
      findBlockedAuthorIds: jest.fn().mockResolvedValue(new Set()),
    } as unknown as jest.Mocked<PostsRepository>;

    likesRepository = {
      getCounts: jest.fn().mockResolvedValue(new Map()),
      findLikedPostIds: jest.fn().mockResolvedValue(new Set()),
      findPostsLikedByUser: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<LikesRepository>;

    savedPostsRepository = {
      findSavedPostIds: jest.fn().mockResolvedValue(new Set()),
      findByUser: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<SavedPostsRepository>;

    prisma = {} as PrismaService;

    neo4j = { run: jest.fn() } as unknown as jest.Mocked<Neo4jService>;

    s3Service = {
      getPublicUrl: jest.fn((key: string) => `https://public/${key}`),
      createPresignedUploadUrl: jest.fn().mockResolvedValue('https://upload-url'),
    } as unknown as jest.Mocked<S3Service>;

    logger = { setContext: jest.fn(), error: jest.fn() } as unknown as jest.Mocked<PinoLogger>;

    usersRepository.findByEmail.mockResolvedValue(null);
    usersRepository.findByUsername.mockResolvedValue(null);
    usersRepository.create.mockResolvedValue(user);
    usersRepository.update.mockResolvedValue(user);
    usersRepository.countFollowers.mockResolvedValue(0);
    usersRepository.countFollowing.mockResolvedValue(0);
    usersRepository.isFollowing.mockResolvedValue(false);
    neo4j.run.mockResolvedValue([]);

    usersService = new UsersService(
      usersRepository,
      postsRepository,
      likesRepository,
      savedPostsRepository,
      prisma,
      neo4j,
      s3Service,
      logger,
    );
  });

  describe('createUser', () => {
    it('throws a conflict when the email is already registered', async () => {
      usersRepository.findByEmail.mockResolvedValue(user);

      await expect(usersService.createUser(createDto)).rejects.toThrow(ConflictException);
      expect(usersRepository.create).not.toHaveBeenCalled();
    });

    it('throws a conflict when the username is already taken', async () => {
      usersRepository.findByUsername.mockResolvedValue(user);

      await expect(usersService.createUser(createDto)).rejects.toThrow(ConflictException);
      expect(usersRepository.create).not.toHaveBeenCalled();
    });

    it('creates the user when there is no conflict', async () => {
      const result = await usersService.createUser(createDto);

      expect(usersRepository.create).toHaveBeenCalledWith(createDto);
      expect(result).toBe(user);
    });

    it('mirrors the new user into Neo4j', async () => {
      await usersService.createUser(createDto);

      expect(neo4j.run).toHaveBeenCalledWith(expect.stringContaining('CREATE'), {
        id: user.id,
        username: user.username,
      });
    });

    it('still returns the user when the Neo4j write fails', async () => {
      neo4j.run.mockRejectedValue(new Error('neo4j unreachable'));

      const result = await usersService.createUser(createDto);

      expect(result).toBe(user);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('throws NotFoundException when the username does not exist', async () => {
      usersRepository.findByUsername.mockResolvedValue(null);

      await expect(usersService.getProfile('missing', 'viewer-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns counts and isFollowing for another user', async () => {
      usersRepository.findByUsername.mockResolvedValue(user);
      usersRepository.countFollowers.mockResolvedValue(5);
      usersRepository.countFollowing.mockResolvedValue(2);
      usersRepository.isFollowing.mockResolvedValue(true);

      const result = await usersService.getProfile('alice', 'viewer-1');

      expect(usersRepository.isFollowing).toHaveBeenCalledWith('viewer-1', user.id);
      expect(result).toEqual({
        id: user.id,
        username: user.username,
        avatarUrl: null,
        isPrivate: false,
        createdAt: user.createdAt,
        followerCount: 5,
        followingCount: 2,
        isFollowing: true,
        hasPendingRequest: false,
        canViewPosts: true,
      });
    });

    it('never calls isFollowing and returns false when viewing your own profile', async () => {
      usersRepository.findByUsername.mockResolvedValue(user);

      const result = await usersService.getProfile('alice', user.id);

      expect(usersRepository.isFollowing).not.toHaveBeenCalled();
      expect(result.isFollowing).toBe(false);
    });

    it('throws NotFoundException when the viewer and the profile owner have blocked each other', async () => {
      usersRepository.findByUsername.mockResolvedValue(user);
      usersRepository.isBlockedEitherDirection.mockResolvedValue(true);

      await expect(usersService.getProfile('alice', 'viewer-1')).rejects.toThrow(NotFoundException);
    });

    it('never checks for a block when viewing your own profile', async () => {
      usersRepository.findByUsername.mockResolvedValue(user);

      await usersService.getProfile('alice', user.id);

      expect(usersRepository.isBlockedEitherDirection).not.toHaveBeenCalled();
    });

    it('sets canViewPosts false for a private account you do not follow', async () => {
      usersRepository.findByUsername.mockResolvedValue({ ...user, isPrivate: true });
      usersRepository.isFollowing.mockResolvedValue(false);

      const result = await usersService.getProfile('alice', 'viewer-1');

      expect(result.canViewPosts).toBe(false);
    });

    it('sets canViewPosts true for a private account you do follow', async () => {
      usersRepository.findByUsername.mockResolvedValue({ ...user, isPrivate: true });
      usersRepository.isFollowing.mockResolvedValue(true);

      const result = await usersService.getProfile('alice', 'viewer-1');

      expect(result.canViewPosts).toBe(true);
    });

    it('reports hasPendingRequest for a private account with a pending request from the viewer', async () => {
      usersRepository.findByUsername.mockResolvedValue({ ...user, isPrivate: true });
      usersRepository.isFollowing.mockResolvedValue(false);
      usersRepository.hasPendingFollowRequest.mockResolvedValue(true);

      const result = await usersService.getProfile('alice', 'viewer-1');

      expect(usersRepository.hasPendingFollowRequest).toHaveBeenCalledWith('viewer-1', user.id);
      expect(result.hasPendingRequest).toBe(true);
    });

    it('never checks for a pending request for a public account', async () => {
      usersRepository.findByUsername.mockResolvedValue(user);

      await usersService.getProfile('alice', 'viewer-1');

      expect(usersRepository.hasPendingFollowRequest).not.toHaveBeenCalled();
    });
  });

  describe('getUserPosts', () => {
    it('throws NotFoundException when the username does not exist', async () => {
      usersRepository.findByUsername.mockResolvedValue(null);

      await expect(usersService.getUserPosts('missing', 'viewer-1', undefined, 20)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the viewer and the profile owner have blocked each other', async () => {
      usersRepository.findByUsername.mockResolvedValue(user);
      usersRepository.isBlockedEitherDirection.mockResolvedValue(true);

      await expect(usersService.getUserPosts('alice', 'viewer-1', undefined, 20)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns a null nextCursor when fewer than a full page came back', async () => {
      usersRepository.findByUsername.mockResolvedValue(user);
      postsRepository.findByAuthor.mockResolvedValue([]);

      const result = await usersService.getUserPosts('alice', 'viewer-1', undefined, 20);

      expect(result.nextCursor).toBeNull();
      expect(result.items).toEqual([]);
    });

    it('returns an empty list without querying posts for a private account you do not follow', async () => {
      usersRepository.findByUsername.mockResolvedValue({ ...user, isPrivate: true });
      usersRepository.isFollowing.mockResolvedValue(false);

      const result = await usersService.getUserPosts('alice', 'viewer-1', undefined, 20);

      expect(postsRepository.findByAuthor).not.toHaveBeenCalled();
      expect(result).toEqual({ items: [], nextCursor: null });
    });

    it('returns posts for a private account you do follow', async () => {
      usersRepository.findByUsername.mockResolvedValue({ ...user, isPrivate: true });
      usersRepository.isFollowing.mockResolvedValue(true);
      postsRepository.findByAuthor.mockResolvedValue([]);

      const result = await usersService.getUserPosts('alice', 'viewer-1', undefined, 20);

      expect(postsRepository.findByAuthor).toHaveBeenCalled();
      expect(result.items).toEqual([]);
    });

    it('returns posts for your own private account', async () => {
      usersRepository.findByUsername.mockResolvedValue({ ...user, isPrivate: true });
      postsRepository.findByAuthor.mockResolvedValue([]);

      const result = await usersService.getUserPosts('alice', user.id, undefined, 20);

      expect(postsRepository.findByAuthor).toHaveBeenCalled();
      expect(result.items).toEqual([]);
    });
  });

  describe('getUserReplies', () => {
    it('throws NotFoundException when the username does not exist', async () => {
      usersRepository.findByUsername.mockResolvedValue(null);

      await expect(
        usersService.getUserReplies('missing', 'viewer-1', undefined, 20),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the viewer and the profile owner have blocked each other', async () => {
      usersRepository.findByUsername.mockResolvedValue(user);
      usersRepository.isBlockedEitherDirection.mockResolvedValue(true);

      await expect(usersService.getUserReplies('alice', 'viewer-1', undefined, 20)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns an empty list without querying replies for a private account you do not follow', async () => {
      usersRepository.findByUsername.mockResolvedValue({ ...user, isPrivate: true });
      usersRepository.isFollowing.mockResolvedValue(false);

      const result = await usersService.getUserReplies('alice', 'viewer-1', undefined, 20);

      expect(postsRepository.findRepliesByAuthor).not.toHaveBeenCalled();
      expect(result).toEqual({ items: [], nextCursor: null });
    });

    it('returns a null nextCursor when fewer than a full page came back', async () => {
      usersRepository.findByUsername.mockResolvedValue(user);
      postsRepository.findRepliesByAuthor.mockResolvedValue([]);

      const result = await usersService.getUserReplies('alice', 'viewer-1', undefined, 20);

      expect(result.nextCursor).toBeNull();
      expect(result.items).toEqual([]);
    });
  });

  describe('getSavedPosts', () => {
    it('excludes saved posts from an author blocked in either direction with the viewer', async () => {
      const savedAt = new Date('2026-07-08T10:00:00.000Z');
      savedPostsRepository.findByUser.mockResolvedValue([
        {
          post: {
            id: 'post-1',
            authorId: 'author-1',
            content: 'hi',
            parentId: null,
            depth: 0,
            replyCount: 0,
            createdAt: savedAt,
            updatedAt: savedAt,
            author: user,
            hashtags: [],
            media: [],
          },
          savedAt,
        },
      ] as never);
      postsRepository.findBlockedAuthorIds.mockResolvedValue(new Set(['author-1']));

      const result = await usersService.getSavedPosts('viewer-1', undefined, 20);

      expect(postsRepository.findBlockedAuthorIds).toHaveBeenCalledWith(prisma, 'viewer-1', [
        'author-1',
      ]);
      expect(result.items).toHaveLength(0);
    });
  });

  describe('getMyLikedPosts', () => {
    it('excludes liked posts from an author blocked in either direction with the viewer', async () => {
      const likedAt = new Date('2026-07-08T10:00:00.000Z');
      likesRepository.findPostsLikedByUser.mockResolvedValue([
        {
          post: {
            id: 'post-1',
            authorId: 'author-1',
            content: 'hi',
            parentId: null,
            depth: 0,
            replyCount: 0,
            createdAt: likedAt,
            updatedAt: likedAt,
            author: user,
            hashtags: [],
            media: [],
          },
          likedAt,
        },
      ] as never);
      postsRepository.findBlockedAuthorIds.mockResolvedValue(new Set(['author-1']));

      const result = await usersService.getMyLikedPosts('viewer-1', undefined, 20);

      expect(postsRepository.findBlockedAuthorIds).toHaveBeenCalledWith(prisma, 'viewer-1', [
        'author-1',
      ]);
      expect(result.items).toHaveLength(0);
    });

    it('marks every returned post as liked', async () => {
      const likedAt = new Date('2026-07-08T10:00:00.000Z');
      likesRepository.findPostsLikedByUser.mockResolvedValue([
        {
          post: {
            id: 'post-1',
            authorId: 'author-1',
            content: 'hi',
            parentId: null,
            depth: 0,
            replyCount: 0,
            createdAt: likedAt,
            updatedAt: likedAt,
            author: user,
            hashtags: [],
            media: [],
          },
          likedAt,
        },
      ] as never);

      const result = await usersService.getMyLikedPosts('viewer-1', undefined, 20);

      expect(result.items[0].isLiked).toBe(true);
    });
  });

  describe('updateProfile', () => {
    it('throws ConflictException when the username is already taken by someone else', async () => {
      usersRepository.findByUsername.mockResolvedValue({ ...user, id: 'someone-else' });

      await expect(usersService.updateProfile(user.id, { username: 'alice' })).rejects.toThrow(
        ConflictException,
      );
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('allows keeping your own username unchanged', async () => {
      usersRepository.findByUsername.mockResolvedValue(user);

      await usersService.updateProfile(user.id, { username: 'alice' });

      expect(usersRepository.update).toHaveBeenCalledWith(user.id, { username: 'alice' });
    });

    it('updates isPrivate when provided', async () => {
      await usersService.updateProfile(user.id, { isPrivate: true });

      expect(usersRepository.update).toHaveBeenCalledWith(user.id, { isPrivate: true });
    });

    it('throws ForbiddenException when the avatar key does not belong to the user', async () => {
      await expect(
        usersService.updateProfile(user.id, { avatarKey: 'avatars/someone-else/pic.png' }),
      ).rejects.toThrow(ForbiddenException);
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('updates the avatar url from an owned avatar key', async () => {
      await usersService.updateProfile(user.id, { avatarKey: `avatars/${user.id}/pic.png` });

      expect(usersRepository.update).toHaveBeenCalledWith(user.id, {
        avatarUrl: `https://public/avatars/${user.id}/pic.png`,
      });
    });

    it('syncs the new username to Neo4j', async () => {
      usersRepository.findByUsername.mockResolvedValue(null);

      await usersService.updateProfile(user.id, { username: 'newname' });

      expect(neo4j.run).toHaveBeenCalledWith(expect.stringContaining('SET'), {
        id: user.id,
        username: 'newname',
      });
    });

    it('still returns the updated profile when the Neo4j sync fails', async () => {
      usersRepository.findByUsername.mockResolvedValue(null);
      neo4j.run.mockRejectedValue(new Error('neo4j unreachable'));

      const result = await usersService.updateProfile(user.id, { username: 'newname' });

      expect(result.id).toBe(user.id);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('presignAvatarUpload', () => {
    it('scopes the S3 key under avatars/<userId>/', async () => {
      const result = await usersService.presignAvatarUpload(user.id, {
        filename: 'pic.png',
        contentType: 'image/png',
        fileSize: 1024,
      });

      expect(result.s3Key).toMatch(new RegExp(`^avatars/${user.id}/`));
      expect(s3Service.createPresignedUploadUrl).toHaveBeenCalledWith(
        result.s3Key,
        'image/png',
        1024,
        expect.any(Number),
      );
    });
  });
});
