import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';

import { RedisService } from '@/infrastructure/redis/redis.service';

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttle:${throttlerName}:${key}`;
    const ttlSeconds = Math.ceil(ttl / 1000);

    const totalHits = await this.redis.incr(redisKey);
    if (totalHits === 1) {
      await this.redis.expire(redisKey, ttlSeconds);
    }

    const remainingMs = await this.redis.pttl(redisKey);
    const timeToExpire = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : ttlSeconds;
    const isBlocked = totalHits > limit;

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked ? timeToExpire : 0,
    };
  }
}
