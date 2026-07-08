import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { FeedRepository } from './feed.repository';
import { FeedService } from './feed.service';
import { encodeFeedCursor } from './utils/feed-cursor.util';

describe('FeedService', () => {
  let feedService: FeedService;
  let prisma: PrismaService;
  let feedRepository: jest.Mocked<FeedRepository>;
  let logger: jest.Mocked<PinoLogger>;

  const author = {
    id: 'author-1',
    email: 'a@example.com',
    username: 'a',
    passwordHash: 'x',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const makePost = (id: string, createdAt: Date) => ({
    id,
    authorId: author.id,
    content: 'hi',
    parentId: null,
    depth: 0,
    createdAt,
    updatedAt: createdAt,
    author,
    hashtags: [],
    media: [],
  });

  beforeEach(() => {
    prisma = {} as PrismaService;

    feedRepository = {
      getFeedEntries: jest.fn().mockResolvedValue([]),
      findCelebrityFolloweeIds: jest.fn().mockResolvedValue([]),
      findCelebrityPostEntries: jest.fn().mockResolvedValue([]),
      findManyByIds: jest.fn().mockResolvedValue([]),
      getLikeCounts: jest.fn().mockResolvedValue(new Map()),
    } as unknown as jest.Mocked<FeedRepository>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    feedService = new FeedService(prisma, feedRepository, logger);
  });

  it('returns fanned-out posts hydrated from Postgres, with like counts attached', async () => {
    const createdAt = new Date('2026-07-08T10:00:00.000Z');
    feedRepository.getFeedEntries.mockResolvedValue([
      { postId: 'post-1', score: createdAt.getTime() },
    ]);
    feedRepository.findManyByIds.mockResolvedValue([makePost('post-1', createdAt)] as never);
    feedRepository.getLikeCounts.mockResolvedValue(new Map([['post-1', 3]]));

    const result = await feedService.getFeed('viewer-1', undefined, 20);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('post-1');
    expect(result.items[0].likeCount).toBe(3);
  });

  it('merges celebrity posts in with fanned-out posts, most recent first', async () => {
    const older = new Date('2026-07-08T09:00:00.000Z');
    const newer = new Date('2026-07-08T10:00:00.000Z');
    feedRepository.findCelebrityFolloweeIds.mockResolvedValue(['celeb-1']);
    feedRepository.getFeedEntries.mockResolvedValue([
      { postId: 'fanned-1', score: older.getTime() },
    ]);
    feedRepository.findCelebrityPostEntries.mockResolvedValue([
      { postId: 'celeb-post-1', score: newer.getTime() },
    ]);
    feedRepository.findManyByIds.mockResolvedValue([
      makePost('fanned-1', older),
      makePost('celeb-post-1', newer),
    ] as never);

    const result = await feedService.getFeed('viewer-1', undefined, 20);

    expect(result.items.map((i) => i.id)).toEqual(['celeb-post-1', 'fanned-1']);
  });

  it('does not query for celebrity posts when the viewer follows no over-threshold accounts', async () => {
    await feedService.getFeed('viewer-1', undefined, 20);

    expect(feedRepository.findCelebrityPostEntries).toHaveBeenCalledWith(prisma, [], undefined, 20);
  });

  it('decodes the incoming cursor and passes it down to both sources', async () => {
    const cursor = encodeFeedCursor(1500);

    await feedService.getFeed('viewer-1', cursor, 20);

    expect(feedRepository.getFeedEntries).toHaveBeenCalledWith('viewer-1', 1500, 20);
    expect(feedRepository.findCelebrityPostEntries).toHaveBeenCalledWith(prisma, [], 1500, 20);
  });

  it('returns a nextCursor when a full page came back', async () => {
    const createdAt = new Date('2026-07-08T10:00:00.000Z');
    feedRepository.getFeedEntries.mockResolvedValue([
      { postId: 'post-1', score: createdAt.getTime() },
    ]);
    feedRepository.findManyByIds.mockResolvedValue([makePost('post-1', createdAt)] as never);

    const result = await feedService.getFeed('viewer-1', undefined, 1);

    expect(result.nextCursor).toBe(encodeFeedCursor(createdAt.getTime()));
  });

  it('returns a null nextCursor when fewer than a full page came back', async () => {
    const createdAt = new Date('2026-07-08T10:00:00.000Z');
    feedRepository.getFeedEntries.mockResolvedValue([
      { postId: 'post-1', score: createdAt.getTime() },
    ]);
    feedRepository.findManyByIds.mockResolvedValue([makePost('post-1', createdAt)] as never);

    const result = await feedService.getFeed('viewer-1', undefined, 20);

    expect(result.nextCursor).toBeNull();
  });
});
