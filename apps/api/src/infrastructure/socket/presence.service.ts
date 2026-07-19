import { Injectable } from '@nestjs/common';

import { RedisService } from '@/infrastructure/redis/redis.service';

import { PRESENCE_LAST_SEEN_TTL_SECONDS } from './socket.constants';

@Injectable()
export class PresenceService {
  constructor(private readonly redis: RedisService) {}

  async addConnection(userId: string, socketId: string): Promise<boolean> {
    const key = this.connectionsKey(userId);
    await this.redis.sadd(key, socketId);
    const count = await this.redis.scard(key);
    return count === 1;
  }

  async removeConnection(userId: string, socketId: string): Promise<boolean> {
    const key = this.connectionsKey(userId);
    await this.redis.srem(key, socketId);
    const count = await this.redis.scard(key);
    return count === 0;
  }

  async isOnline(userId: string): Promise<boolean> {
    const count = await this.redis.scard(this.connectionsKey(userId));
    return count > 0;
  }

  async touchLastSeen(userId: string): Promise<void> {
    await this.redis.set(
      this.lastSeenKey(userId),
      Date.now(),
      'EX',
      PRESENCE_LAST_SEEN_TTL_SECONDS,
    );
  }

  private connectionsKey(userId: string): string {
    return `presence:connections:${userId}`;
  }

  private lastSeenKey(userId: string): string {
    return `presence:lastSeen:${userId}`;
  }
}
