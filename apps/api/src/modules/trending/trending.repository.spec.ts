import { RedisService } from '@/infrastructure/redis/redis.service';

import { TRENDING_KEY, TRENDING_MAX_SIZE } from './trending.constants';
import { TrendingRepository } from './trending.repository';

describe('TrendingRepository', () => {
  let trendingRepository: TrendingRepository;
  let redis: jest.Mocked<RedisService>;

  beforeEach(() => {
    redis = {
      incr: jest.fn().mockResolvedValue(1),
      zadd: jest.fn(),
      zremrangebyrank: jest.fn(),
      zrevrange: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<RedisService>;

    trendingRepository = new TrendingRepository(redis);
  });

  describe('recordUsage', () => {
    it('increments the per-tag counter and adds a score to the sorted set', async () => {
      (redis.incr as jest.Mock).mockResolvedValue(5);

      await trendingRepository.recordUsage('nestjs');

      expect(redis.incr).toHaveBeenCalledWith('trending:count:nestjs');
      expect(redis.zadd).toHaveBeenCalledWith(TRENDING_KEY, expect.any(Number), 'nestjs');
    });

    it('trims the sorted set to TRENDING_MAX_SIZE after every write', async () => {
      await trendingRepository.recordUsage('nestjs');

      expect(redis.zremrangebyrank).toHaveBeenCalledWith(TRENDING_KEY, 0, -(TRENDING_MAX_SIZE + 1));
    });

    it('gives a higher score to a tag with a higher usage count', async () => {
      (redis.incr as jest.Mock).mockResolvedValueOnce(1);
      await trendingRepository.recordUsage('rare');
      const rareScore = (redis.zadd as jest.Mock).mock.calls[0][1];

      (redis.incr as jest.Mock).mockResolvedValueOnce(1000);
      await trendingRepository.recordUsage('popular');
      const popularScore = (redis.zadd as jest.Mock).mock.calls[1][1];

      expect(popularScore).toBeGreaterThan(rareScore);
    });
  });

  describe('getTop', () => {
    it('parses the flat WITHSCORES array into tag/score pairs, highest first', async () => {
      (redis.zrevrange as jest.Mock).mockResolvedValue(['nestjs', '2.5', 'redis', '1.2']);

      const entries = await trendingRepository.getTop(10);

      expect(redis.zrevrange).toHaveBeenCalledWith(TRENDING_KEY, 0, 9, 'WITHSCORES');
      expect(entries).toEqual([
        { tag: 'nestjs', score: 2.5 },
        { tag: 'redis', score: 1.2 },
      ]);
    });

    it('returns an empty array when nothing is trending', async () => {
      const entries = await trendingRepository.getTop(10);

      expect(entries).toEqual([]);
    });
  });
});
