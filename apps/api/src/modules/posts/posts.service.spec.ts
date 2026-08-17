import { PinoLogger } from 'nestjs-pino';

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { FanoutQueue } from '@/modules/feed/fanout/queue/fanout.queue';
import { MediaRepository } from '@/modules/media/media.repository';
import { MediaService } from '@/modules/media/media.service';
import { ImageProcessingQueue } from '@/modules/media/queue/image-processing.queue';
import { NotificationDeliveryQueue } from '@/modules/notifications/delivery/queue/notification-delivery.queue';
import { NotificationsRepository } from '@/modules/notifications/notifications.repository';
import { TrendingService } from '@/modules/trending/trending.service';

import { HashtagsRepository } from './hashtags.repository';
import { LikesRepository } from './likes.repository';
import { PostsRepository } from './posts.repository';
import { PostsService } from './posts.service';
import { SavedPostsRepository } from './saved-posts.repository';

describe('PostsService', () => {
  let postsService: PostsService;
  let prisma: jest.Mocked<PrismaService>;
  let postsRepository: jest.Mocked<PostsRepository>;
  let hashtagsRepository: jest.Mocked<HashtagsRepository>;
  let likesRepository: jest.Mocked<LikesRepository>;
  let savedPostsRepository: jest.Mocked<SavedPostsRepository>;
  let mediaService: jest.Mocked<MediaService>;
  let mediaRepository: jest.Mocked<MediaRepository>;
  let imageProcessingQueue: jest.Mocked<ImageProcessingQueue>;
  let fanoutQueue: jest.Mocked<FanoutQueue>;
  let notificationsRepository: jest.Mocked<NotificationsRepository>;
  let notificationDeliveryQueue: jest.Mocked<NotificationDeliveryQueue>;
  let trendingService: jest.Mocked<TrendingService>;
  let logger: jest.Mocked<PinoLogger>;

  const tx = {} as never;

  const author = {
    id: 'user-1',
    email: 'a@example.com',
    username: 'a',
    passwordHash: 'x',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createdPost = {
    id: 'post-1',
    authorId: 'user-1',
    content: 'hi',
    parentId: null,
    depth: 0,
    replyCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    author,
    hashtags: [],
    media: [],
  };

  const refetchedPost = {
    ...createdPost,
    media: [
      {
        id: 'media-1',
        postId: 'post-1',
        s3Key: 'media/user-1/a.jpg',
        url: 'https://public/media/user-1/a.jpg',
        thumbnailUrl: null,
        blurHash: null,
        width: null,
        height: null,
        order: 0,
        processingStatus: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    } as unknown as jest.Mocked<PrismaService>;

    postsRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findDepthById: jest.fn(),
      incrementReplyCount: jest.fn(),
      findReplies: jest.fn(),
      findFollowedAuthorIds: jest.fn().mockResolvedValue(new Set()),
      isBlockedEitherDirection: jest.fn().mockResolvedValue(false),
      findBlockedAuthorIds: jest.fn().mockResolvedValue(new Set()),
    } as unknown as jest.Mocked<PostsRepository>;

    hashtagsRepository = {
      findOrCreateMany: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<HashtagsRepository>;

    likesRepository = {
      initializeCount: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
      getCount: jest.fn().mockResolvedValue(0),
      getCounts: jest.fn().mockResolvedValue(new Map()),
      findLikedPostIds: jest.fn().mockResolvedValue(new Set()),
    } as unknown as jest.Mocked<LikesRepository>;

    savedPostsRepository = {
      save: jest.fn(),
      unsave: jest.fn(),
      findSavedPostIds: jest.fn().mockResolvedValue(new Set()),
      findByUser: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<SavedPostsRepository>;

    mediaService = {
      assertOwnedByUser: jest.fn(),
      getPublicUrl: jest.fn((key: string) => `https://public/${key}`),
    } as unknown as jest.Mocked<MediaService>;

    mediaRepository = {
      create: jest.fn(),
    } as unknown as jest.Mocked<MediaRepository>;

    imageProcessingQueue = {
      enqueueThumbnailJob: jest.fn(),
    } as unknown as jest.Mocked<ImageProcessingQueue>;

    fanoutQueue = {
      enqueueFanout: jest.fn(),
    } as unknown as jest.Mocked<FanoutQueue>;

    notificationsRepository = {
      createIfNotSelf: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<NotificationsRepository>;

    notificationDeliveryQueue = {
      enqueueDelivery: jest.fn(),
    } as unknown as jest.Mocked<NotificationDeliveryQueue>;

    trendingService = {
      recordUsage: jest.fn(),
    } as unknown as jest.Mocked<TrendingService>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    postsService = new PostsService(
      prisma,
      postsRepository,
      hashtagsRepository,
      likesRepository,
      savedPostsRepository,
      mediaService,
      mediaRepository,
      imageProcessingQueue,
      fanoutQueue,
      notificationsRepository,
      notificationDeliveryQueue,
      trendingService,
      logger,
    );

    postsRepository.create.mockResolvedValue(createdPost as never);
    postsRepository.findById.mockResolvedValue(refetchedPost as never);
  });

  describe('createPost', () => {
    it('validates media ownership before creating anything', async () => {
      mediaService.assertOwnedByUser.mockImplementation(() => {
        throw new ForbiddenException('nope');
      });

      await expect(
        postsService.createPost('user-1', { content: 'hi', mediaKeys: ['media/user-2/a.jpg'] }),
      ).rejects.toThrow(ForbiddenException);

      expect(postsRepository.create).not.toHaveBeenCalled();
    });

    it('creates a Media row per key, in order, inside the transaction', async () => {
      await postsService.createPost('user-1', {
        content: 'hi',
        mediaKeys: ['media/user-1/a.jpg', 'media/user-1/b.jpg'],
      });

      expect(mediaRepository.create).toHaveBeenNthCalledWith(1, tx, {
        postId: 'post-1',
        s3Key: 'media/user-1/a.jpg',
        url: 'https://public/media/user-1/a.jpg',
        order: 0,
      });
      expect(mediaRepository.create).toHaveBeenNthCalledWith(2, tx, {
        postId: 'post-1',
        s3Key: 'media/user-1/b.jpg',
        url: 'https://public/media/user-1/b.jpg',
        order: 1,
      });
    });

    it('re-fetches the post so the response reflects attached media', async () => {
      const result = await postsService.createPost('user-1', {
        content: 'hi',
        mediaKeys: ['media/user-1/a.jpg'],
      });

      expect(postsRepository.findById).toHaveBeenCalledWith(tx, 'post-1');
      expect(result.media).toHaveLength(1);
    });

    it('creates no Media rows when mediaKeys is omitted', async () => {
      await postsService.createPost('user-1', { content: 'hi' });

      expect(mediaRepository.create).not.toHaveBeenCalled();
    });

    it('enqueues a thumbnail job for each attached media row, after the transaction commits', async () => {
      await postsService.createPost('user-1', {
        content: 'hi',
        mediaKeys: ['media/user-1/a.jpg'],
      });

      expect(imageProcessingQueue.enqueueThumbnailJob).toHaveBeenCalledWith('media-1');
      expect(imageProcessingQueue.enqueueThumbnailJob).toHaveBeenCalledTimes(1);
    });

    it('enqueues no jobs when no media was attached', async () => {
      postsRepository.findById.mockResolvedValue(createdPost as never);

      await postsService.createPost('user-1', { content: 'hi' });

      expect(imageProcessingQueue.enqueueThumbnailJob).not.toHaveBeenCalled();
    });

    it('enqueues a fanout job after the transaction commits', async () => {
      await postsService.createPost('user-1', { content: 'hi' });

      expect(fanoutQueue.enqueueFanout).toHaveBeenCalledWith(
        'post-1',
        'user-1',
        createdPost.createdAt,
      );
      expect(fanoutQueue.enqueueFanout).toHaveBeenCalledTimes(1);
    });

    it('records trending usage for each hashtag in the content, after the transaction commits', async () => {
      await postsService.createPost('user-1', { content: 'hi #foo #bar' });

      expect(trendingService.recordUsage).toHaveBeenCalledWith(['foo', 'bar']);
    });

    it('records an empty trending usage call when there are no hashtags', async () => {
      await postsService.createPost('user-1', { content: 'hi' });

      expect(trendingService.recordUsage).toHaveBeenCalledWith([]);
    });
  });

  describe('createReply', () => {
    beforeEach(() => {
      postsRepository.findDepthById.mockResolvedValue({ depth: 0, authorId: 'parent-author-1' });
    });

    it('throws NotFoundException when the parent post does not exist', async () => {
      postsRepository.findDepthById.mockResolvedValue(null);

      await expect(
        postsService.createReply('user-1', 'missing', { content: 'hi' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the replier and the parent author have blocked each other', async () => {
      postsRepository.isBlockedEitherDirection.mockResolvedValue(true);

      await expect(
        postsService.createReply('user-1', 'parent-1', { content: 'hi' }),
      ).rejects.toThrow(ForbiddenException);

      expect(postsRepository.create).not.toHaveBeenCalled();
    });

    it('validates media ownership before creating anything', async () => {
      mediaService.assertOwnedByUser.mockImplementation(() => {
        throw new ForbiddenException('nope');
      });

      await expect(
        postsService.createReply('user-1', 'parent-1', {
          content: 'hi',
          mediaKeys: ['media/user-2/a.jpg'],
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(postsRepository.create).not.toHaveBeenCalled();
    });

    it('sets depth to parent depth + 1 and attaches media', async () => {
      postsRepository.findDepthById.mockResolvedValue({ depth: 2, authorId: 'parent-author-1' });

      await postsService.createReply('user-1', 'parent-1', {
        content: 'hi',
        mediaKeys: ['media/user-1/a.jpg'],
      });

      expect(postsRepository.create).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ parentId: 'parent-1', depth: 3 }),
      );
      expect(mediaRepository.create).toHaveBeenCalledWith(tx, {
        postId: 'post-1',
        s3Key: 'media/user-1/a.jpg',
        url: 'https://public/media/user-1/a.jpg',
        order: 0,
      });
    });

    it('does not enqueue a fanout job for replies', async () => {
      await postsService.createReply('user-1', 'parent-1', { content: 'hi' });

      expect(fanoutQueue.enqueueFanout).not.toHaveBeenCalled();
    });

    it('increments the parent post reply count inside the transaction', async () => {
      await postsService.createReply('user-1', 'parent-1', { content: 'hi' });

      expect(postsRepository.incrementReplyCount).toHaveBeenCalledWith(tx, 'parent-1');
    });

    it('creates a REPLY notification for the parent post author and enqueues its delivery', async () => {
      notificationsRepository.createIfNotSelf.mockResolvedValue({
        id: 'notification-1',
      } as never);

      await postsService.createReply('user-1', 'parent-1', { content: 'hi' });

      expect(notificationsRepository.createIfNotSelf).toHaveBeenCalledWith(tx, {
        actorId: 'user-1',
        recipientId: 'parent-author-1',
        type: 'REPLY',
        postId: 'post-1',
      });
      expect(notificationDeliveryQueue.enqueueDelivery).toHaveBeenCalledWith('notification-1');
    });

    it('does not enqueue delivery when no notification was created (self-reply)', async () => {
      await postsService.createReply('user-1', 'parent-1', { content: 'hi' });

      expect(notificationDeliveryQueue.enqueueDelivery).not.toHaveBeenCalled();
    });

    it('records trending usage for hashtags in a reply too', async () => {
      await postsService.createReply('user-1', 'parent-1', { content: 'hi #foo' });

      expect(trendingService.recordUsage).toHaveBeenCalledWith(['foo']);
    });
  });

  describe('getPost', () => {
    it('throws NotFoundException when the post does not exist', async () => {
      postsRepository.findById.mockResolvedValue(null);

      await expect(postsService.getPost('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the viewer and the author have blocked each other', async () => {
      postsRepository.isBlockedEitherDirection.mockResolvedValue(true);

      await expect(postsService.getPost('user-1', 'post-1')).rejects.toThrow(NotFoundException);
    });

    it('sets isLiked true when the viewer has liked the post', async () => {
      likesRepository.getCount.mockResolvedValue(5);
      likesRepository.findLikedPostIds.mockResolvedValue(new Set(['post-1']));

      const result = await postsService.getPost('user-1', 'post-1');

      expect(likesRepository.findLikedPostIds).toHaveBeenCalledWith(prisma, 'user-1', ['post-1']);
      expect(result.likeCount).toBe(5);
      expect(result.isLiked).toBe(true);
    });

    it('sets isLiked false when the viewer has not liked the post', async () => {
      likesRepository.findLikedPostIds.mockResolvedValue(new Set());

      const result = await postsService.getPost('user-1', 'post-1');

      expect(result.isLiked).toBe(false);
    });

    it('sets isFollowing true when the viewer already follows the author', async () => {
      postsRepository.findFollowedAuthorIds.mockResolvedValue(new Set(['user-1']));

      const result = await postsService.getPost('viewer-1', 'post-1');

      expect(postsRepository.findFollowedAuthorIds).toHaveBeenCalledWith(prisma, 'viewer-1', [
        'user-1',
      ]);
      expect(result.isFollowing).toBe(true);
    });

    it('sets isFollowing false when the viewer does not follow the author', async () => {
      postsRepository.findFollowedAuthorIds.mockResolvedValue(new Set());

      const result = await postsService.getPost('viewer-1', 'post-1');

      expect(result.isFollowing).toBe(false);
    });
  });

  describe('getReplies', () => {
    const reply = { ...createdPost, id: 'reply-1', parentId: 'parent-1', depth: 1 };

    beforeEach(() => {
      postsRepository.findDepthById.mockResolvedValue({ depth: 0, authorId: 'parent-author-1' });
      postsRepository.findReplies.mockResolvedValue([reply] as never);
    });

    it('throws NotFoundException when the parent post does not exist', async () => {
      postsRepository.findDepthById.mockResolvedValue(null);

      await expect(postsService.getReplies('user-1', 'missing', undefined, 20)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the viewer and the parent author have blocked each other', async () => {
      postsRepository.isBlockedEitherDirection.mockResolvedValue(true);

      await expect(postsService.getReplies('user-1', 'parent-1', undefined, 20)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('excludes replies from an author blocked in either direction with the viewer', async () => {
      postsRepository.findBlockedAuthorIds.mockResolvedValue(new Set(['user-1']));

      const result = await postsService.getReplies('viewer-1', 'parent-1', undefined, 20);

      expect(postsRepository.findBlockedAuthorIds).toHaveBeenCalledWith(prisma, 'viewer-1', [
        'user-1',
      ]);
      expect(result.items).toHaveLength(0);
    });

    it('returns replies with per-reply like counts and isLiked flags', async () => {
      likesRepository.getCounts.mockResolvedValue(new Map([['reply-1', 3]]));
      likesRepository.findLikedPostIds.mockResolvedValue(new Set(['reply-1']));

      const result = await postsService.getReplies('user-1', 'parent-1', undefined, 20);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].likeCount).toBe(3);
      expect(result.items[0].isLiked).toBe(true);
    });

    it('returns isFollowing per reply author', async () => {
      postsRepository.findFollowedAuthorIds.mockResolvedValue(new Set(['user-1']));

      const result = await postsService.getReplies('viewer-1', 'parent-1', undefined, 20);

      expect(postsRepository.findFollowedAuthorIds).toHaveBeenCalledWith(prisma, 'viewer-1', [
        'user-1',
      ]);
      expect(result.items[0].isFollowing).toBe(true);
    });

    it('returns a null nextCursor when fewer than a full page came back', async () => {
      const result = await postsService.getReplies('user-1', 'parent-1', undefined, 20);

      expect(result.nextCursor).toBeNull();
    });

    it('returns an encoded nextCursor when a full page came back', async () => {
      postsRepository.findReplies.mockResolvedValue([reply] as never);

      const result = await postsService.getReplies('user-1', 'parent-1', undefined, 1);

      expect(result.nextCursor).not.toBeNull();
    });
  });

  describe('likePost', () => {
    beforeEach(() => {
      postsRepository.findDepthById.mockResolvedValue({ depth: 0, authorId: 'post-author-1' });
      likesRepository.findOne.mockResolvedValue(null);
    });

    it('throws NotFoundException when the post does not exist', async () => {
      postsRepository.findDepthById.mockResolvedValue(null);

      await expect(postsService.likePost('user-1', 'post-1')).rejects.toThrow(NotFoundException);
      expect(likesRepository.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when already liked', async () => {
      likesRepository.findOne.mockResolvedValue({
        id: 'like-1',
        userId: 'user-1',
        postId: 'post-1',
        createdAt: new Date(),
      });

      await expect(postsService.likePost('user-1', 'post-1')).rejects.toThrow(ConflictException);
      expect(likesRepository.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the liker and the post author have blocked each other', async () => {
      postsRepository.isBlockedEitherDirection.mockResolvedValue(true);

      await expect(postsService.likePost('user-1', 'post-1')).rejects.toThrow(ForbiddenException);
      expect(likesRepository.create).not.toHaveBeenCalled();
    });

    it('creates the Like row and increments the counter', async () => {
      await postsService.likePost('user-1', 'post-1');

      expect(likesRepository.create).toHaveBeenCalledWith(tx, 'user-1', 'post-1');
      expect(likesRepository.increment).toHaveBeenCalledWith('post-1');
    });

    it('creates a LIKE notification for the post author and enqueues its delivery', async () => {
      notificationsRepository.createIfNotSelf.mockResolvedValue({
        id: 'notification-1',
      } as never);

      await postsService.likePost('user-1', 'post-1');

      expect(notificationsRepository.createIfNotSelf).toHaveBeenCalledWith(tx, {
        actorId: 'user-1',
        recipientId: 'post-author-1',
        type: 'LIKE',
        postId: 'post-1',
      });
      expect(notificationDeliveryQueue.enqueueDelivery).toHaveBeenCalledWith('notification-1');
    });

    it('does not enqueue delivery when no notification was created (self-like)', async () => {
      await postsService.likePost('user-1', 'post-1');

      expect(notificationDeliveryQueue.enqueueDelivery).not.toHaveBeenCalled();
    });
  });

  describe('unlikePost', () => {
    it('does not create a notification for unliking', async () => {
      likesRepository.findOne.mockResolvedValue({
        id: 'like-1',
        userId: 'user-1',
        postId: 'post-1',
        createdAt: new Date(),
      });

      await postsService.unlikePost('user-1', 'post-1');

      expect(notificationsRepository.createIfNotSelf).not.toHaveBeenCalled();
    });

    it('is a no-op when not currently liked', async () => {
      likesRepository.findOne.mockResolvedValue(null);

      await postsService.unlikePost('user-1', 'post-1');

      expect(likesRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('savePost', () => {
    it('throws NotFoundException when the post does not exist', async () => {
      postsRepository.findDepthById.mockResolvedValue(null);

      await expect(postsService.savePost('user-1', 'missing')).rejects.toThrow(NotFoundException);
      expect(savedPostsRepository.save).not.toHaveBeenCalled();
    });

    it('saves the post', async () => {
      postsRepository.findDepthById.mockResolvedValue({ depth: 0, authorId: 'post-author-1' });

      await postsService.savePost('user-1', 'post-1');

      expect(savedPostsRepository.save).toHaveBeenCalledWith(prisma, 'user-1', 'post-1');
    });
  });

  describe('unsavePost', () => {
    it('unsaves the post', async () => {
      await postsService.unsavePost('user-1', 'post-1');

      expect(savedPostsRepository.unsave).toHaveBeenCalledWith(prisma, 'user-1', 'post-1');
    });
  });
});
