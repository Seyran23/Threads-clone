import { PinoLogger } from 'nestjs-pino';

import { ForbiddenException, NotFoundException } from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { MediaRepository } from '@/modules/media/media.repository';
import { MediaService } from '@/modules/media/media.service';
import { ImageProcessingQueue } from '@/modules/media/queue/image-processing.queue';

import { HashtagsRepository } from './hashtags.repository';
import { LikesRepository } from './likes.repository';
import { PostsRepository } from './posts.repository';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let postsService: PostsService;
  let prisma: jest.Mocked<PrismaService>;
  let postsRepository: jest.Mocked<PostsRepository>;
  let hashtagsRepository: jest.Mocked<HashtagsRepository>;
  let likesRepository: jest.Mocked<LikesRepository>;
  let mediaService: jest.Mocked<MediaService>;
  let mediaRepository: jest.Mocked<MediaRepository>;
  let imageProcessingQueue: jest.Mocked<ImageProcessingQueue>;
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
    } as unknown as jest.Mocked<PostsRepository>;

    hashtagsRepository = {
      findOrCreateMany: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<HashtagsRepository>;

    likesRepository = {
      initializeCount: jest.fn(),
    } as unknown as jest.Mocked<LikesRepository>;

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
      mediaService,
      mediaRepository,
      imageProcessingQueue,
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
  });

  describe('createReply', () => {
    beforeEach(() => {
      postsRepository.findDepthById.mockResolvedValue({ depth: 0 });
    });

    it('throws NotFoundException when the parent post does not exist', async () => {
      postsRepository.findDepthById.mockResolvedValue(null);

      await expect(
        postsService.createReply('user-1', 'missing', { content: 'hi' }),
      ).rejects.toThrow(NotFoundException);
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
      postsRepository.findDepthById.mockResolvedValue({ depth: 2 });

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
  });
});
