import { Injectable } from '@nestjs/common';

import { RedisService } from '@/infrastructure/redis/redis.service';

import {
  TRENDING_KEY,
  TRENDING_MAX_SIZE,
  TRENDING_TIME_CONSTANT_SECONDS,
} from './trending.constants';

@Injectable()
export class TrendingRepository {
  constructor(private readonly redis: RedisService) {}

  async recordUsage(tag: string): Promise<void> {
    const count = await this.redis.incr(this.countKey(tag));
    const score = Math.log10(count) + Date.now() / 1000 / TRENDING_TIME_CONSTANT_SECONDS;

    await this.redis.zadd(TRENDING_KEY, score, tag);
    await this.redis.zremrangebyrank(TRENDING_KEY, 0, -(TRENDING_MAX_SIZE + 1));
  }

  async getTop(limit: number): Promise<{ tag: string; score: number }[]> {
    const raw = await this.redis.zrevrange(TRENDING_KEY, 0, limit - 1, 'WITHSCORES');

    const entries: { tag: string; score: number }[] = [];

    for (let i = 0; i < raw.length; i += 2) {
      entries.push({ tag: raw[i], score: Number(raw[i + 1]) });
    }

    return entries;
  }

  private countKey(tag: string): string {
    return `trending:count:${tag}`;
  }
}
