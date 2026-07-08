import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';
import { RedisService } from '@/infrastructure/redis/redis.service';

import { FEED_MAX_SIZE } from './fanout/fanout.constants';
import { FeedRepository } from './feed.repository';

describe('FeedRepository', () => {
  let feedRepository: FeedRepository;
  let redis: jest.Mocked<RedisService>;
  let tx: jest.Mocked<PrismaClientOrTx>;

  beforeEach(() => {
    redis = {
      zadd: jest.fn(),
      zremrangebyrank: jest.fn(),
      zrevrangebyscore: jest.fn().mockResolvedValue([]),
      mget: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<RedisService>;

    tx = {
      follow: {
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      post: {
        update: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClientOrTx>;

    feedRepository = new FeedRepository(redis);
  });

  describe('pushToFeed', () => {
    it('adds the post to the user feed sorted set keyed by score, then trims to FEED_MAX_SIZE', async () => {
      await feedRepository.pushToFeed('user-1', 'post-1', 1000);

      expect(redis.zadd).toHaveBeenCalledWith('feed:user-1', 1000, 'post-1');
      expect(redis.zremrangebyrank).toHaveBeenCalledWith('feed:user-1', 0, -(FEED_MAX_SIZE + 1));
    });
  });

  describe('countFollowers', () => {
    it('counts follows where the author is the followee', async () => {
      (tx.follow.count as jest.Mock).mockResolvedValue(5);

      const count = await feedRepository.countFollowers(tx, 'author-1');

      expect(tx.follow.count).toHaveBeenCalledWith({ where: { followeeId: 'author-1' } });
      expect(count).toBe(5);
    });
  });

  describe('findFollowerIds', () => {
    it('returns the followerIds of everyone following the author', async () => {
      (tx.follow.findMany as jest.Mock).mockResolvedValue([
        { followerId: 'user-1' },
        { followerId: 'user-2' },
      ]);

      const ids = await feedRepository.findFollowerIds(tx, 'author-1');

      expect(tx.follow.findMany).toHaveBeenCalledWith({
        where: { followeeId: 'author-1' },
        select: { followerId: true },
      });
      expect(ids).toEqual(['user-1', 'user-2']);
    });
  });

  describe('markFanoutCompleted', () => {
    it('sets the post fanoutStatus to COMPLETED', async () => {
      await feedRepository.markFanoutCompleted(tx, 'post-1');

      expect(tx.post.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { fanoutStatus: 'COMPLETED' },
      });
    });
  });

  describe('findStuckPendingFanout', () => {
    it('queries only top-level, PENDING posts older than the stuck threshold', async () => {
      await feedRepository.findStuckPendingFanout(tx);

      expect(tx.post.findMany).toHaveBeenCalledWith({
        where: {
          parentId: null,
          fanoutStatus: 'PENDING',
          createdAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('getFeedEntries', () => {
    it('reads the sorted set descending from +inf when there is no cursor', async () => {
      (redis.zrevrangebyscore as jest.Mock).mockResolvedValue(['post-2', '2000', 'post-1', '1000']);

      const entries = await feedRepository.getFeedEntries('user-1', undefined, 20);

      expect(redis.zrevrangebyscore).toHaveBeenCalledWith(
        'feed:user-1',
        '+inf',
        '-inf',
        'WITHSCORES',
        'LIMIT',
        0,
        20,
      );
      expect(entries).toEqual([
        { postId: 'post-2', score: 2000 },
        { postId: 'post-1', score: 1000 },
      ]);
    });

    it('reads strictly below the cursor score when one is given', async () => {
      await feedRepository.getFeedEntries('user-1', 1500, 20);

      expect(redis.zrevrangebyscore).toHaveBeenCalledWith(
        'feed:user-1',
        '(1500',
        '-inf',
        'WITHSCORES',
        'LIMIT',
        0,
        20,
      );
    });
  });

  describe('findCelebrityFolloweeIds', () => {
    it('returns an empty array without querying groupBy when the viewer follows no one', async () => {
      (tx.follow.findMany as jest.Mock).mockResolvedValue([]);

      const ids = await feedRepository.findCelebrityFolloweeIds(tx, 'viewer-1');

      expect(tx.follow.groupBy).not.toHaveBeenCalled();
      expect(ids).toEqual([]);
    });

    it('returns only followees whose follower count is over the hybrid threshold', async () => {
      (tx.follow.findMany as jest.Mock).mockResolvedValue([
        { followeeId: 'celeb-1' },
        { followeeId: 'regular-1' },
      ]);
      (tx.follow.groupBy as jest.Mock).mockResolvedValue([
        { followeeId: 'celeb-1', _count: { followerId: 10001 } },
      ]);

      const ids = await feedRepository.findCelebrityFolloweeIds(tx, 'viewer-1');

      expect(tx.follow.groupBy).toHaveBeenCalledWith({
        by: ['followeeId'],
        where: { followeeId: { in: ['celeb-1', 'regular-1'] } },
        _count: { followerId: true },
        having: { followerId: { _count: { gt: 10_000 } } },
      });
      expect(ids).toEqual(['celeb-1']);
    });
  });

  describe('findCelebrityPostEntries', () => {
    it('returns an empty array without querying Postgres when there are no celebrity authors', async () => {
      const entries = await feedRepository.findCelebrityPostEntries(tx, [], undefined, 20);

      expect(tx.post.findMany).not.toHaveBeenCalled();
      expect(entries).toEqual([]);
    });

    it('queries top-level posts by the given authors, newest first, capped at limit', async () => {
      const createdAt = new Date('2026-07-08T10:00:00.000Z');
      (tx.post.findMany as jest.Mock).mockResolvedValue([{ id: 'post-1', createdAt }]);

      const entries = await feedRepository.findCelebrityPostEntries(tx, ['celeb-1'], undefined, 20);

      expect(tx.post.findMany).toHaveBeenCalledWith({
        where: { authorId: { in: ['celeb-1'] }, parentId: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, createdAt: true },
      });
      expect(entries).toEqual([{ postId: 'post-1', score: createdAt.getTime() }]);
    });

    it('filters by createdAt strictly before the cursor when one is given', async () => {
      (tx.post.findMany as jest.Mock).mockResolvedValue([]);

      await feedRepository.findCelebrityPostEntries(tx, ['celeb-1'], 1500, 20);

      expect(tx.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            authorId: { in: ['celeb-1'] },
            parentId: null,
            createdAt: { lt: new Date(1500) },
          },
        }),
      );
    });
  });

  describe('findManyByIds', () => {
    it('returns an empty array without querying Postgres for an empty id list', async () => {
      const posts = await feedRepository.findManyByIds(tx, []);

      expect(tx.post.findMany).not.toHaveBeenCalled();
      expect(posts).toEqual([]);
    });

    it('queries posts by id with the full include shape', async () => {
      await feedRepository.findManyByIds(tx, ['post-1', 'post-2']);

      expect(tx.post.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['post-1', 'post-2'] } },
        include: expect.objectContaining({
          author: true,
          hashtags: expect.anything(),
          media: expect.anything(),
        }),
      });
    });
  });

  describe('getLikeCounts', () => {
    it('returns an empty map without querying Redis for an empty id list', async () => {
      const counts = await feedRepository.getLikeCounts([]);

      expect(redis.mget).not.toHaveBeenCalled();
      expect(counts.size).toBe(0);
    });

    it('reads like counts keyed by postId, defaulting missing entries to 0', async () => {
      (redis.mget as jest.Mock).mockResolvedValue(['5', null]);

      const counts = await feedRepository.getLikeCounts(['post-1', 'post-2']);

      expect(redis.mget).toHaveBeenCalledWith('post:post-1:likes', 'post:post-2:likes');
      expect(counts.get('post-1')).toBe(5);
      expect(counts.get('post-2')).toBe(0);
    });
  });
});
