import { RedisService } from '@/infrastructure/redis/redis.service';

import { RedisThrottlerStorage } from './redis-throttler-storage.service';

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;
  let redis: jest.Mocked<RedisService>;

  beforeEach(() => {
    redis = {
      incr: jest.fn(),
      expire: jest.fn(),
      pttl: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    storage = new RedisThrottlerStorage(redis);
  });

  it('sets an expiry only on the first hit of a window', async () => {
    redis.incr.mockResolvedValue(1);
    redis.pttl.mockResolvedValue(60_000);

    await storage.increment('user-1', 60_000, 20, 60_000, 'default');

    expect(redis.incr).toHaveBeenCalledWith('throttle:default:user-1');
    expect(redis.expire).toHaveBeenCalledWith('throttle:default:user-1', 60);
  });

  it('does not reset the expiry on subsequent hits within the window', async () => {
    redis.incr.mockResolvedValue(5);
    redis.pttl.mockResolvedValue(45_000);

    await storage.increment('user-1', 60_000, 20, 60_000, 'default');

    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('is not blocked while under the limit', async () => {
    redis.incr.mockResolvedValue(10);
    redis.pttl.mockResolvedValue(30_000);

    const result = await storage.increment('user-1', 60_000, 20, 60_000, 'default');

    expect(result).toEqual({
      totalHits: 10,
      timeToExpire: 30,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('is blocked once hits exceed the limit', async () => {
    redis.incr.mockResolvedValue(21);
    redis.pttl.mockResolvedValue(15_000);

    const result = await storage.increment('user-1', 60_000, 20, 60_000, 'default');

    expect(result).toEqual({
      totalHits: 21,
      timeToExpire: 15,
      isBlocked: true,
      timeToBlockExpire: 15,
    });
  });

  it('falls back to the configured ttl when pttl reports no expiry', async () => {
    redis.incr.mockResolvedValue(1);
    redis.pttl.mockResolvedValue(-1);

    const result = await storage.increment('user-1', 60_000, 20, 60_000, 'default');

    expect(result.timeToExpire).toBe(60);
  });

  it('namespaces the Redis key by throttler name and tracker key', async () => {
    redis.incr.mockResolvedValue(1);
    redis.pttl.mockResolvedValue(60_000);

    await storage.increment('198.51.100.4', 60_000, 5, 60_000, 'auth');

    expect(redis.incr).toHaveBeenCalledWith('throttle:auth:198.51.100.4');
  });
});
