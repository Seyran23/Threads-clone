import { Injectable } from '@nestjs/common';

import { Like } from '@/generated/prisma';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';
import { RedisService } from '@/infrastructure/redis/redis.service';

@Injectable()
export class LikesRepository {
  constructor(private readonly redis: RedisService) {}

  findOne(tx: PrismaClientOrTx, userId: string, postId: string): Promise<Like | null> {
    return tx.like.findUnique({ where: { userId_postId: { userId, postId } } });
  }

  create(tx: PrismaClientOrTx, userId: string, postId: string): Promise<Like> {
    return tx.like.create({ data: { userId, postId } });
  }

  async delete(tx: PrismaClientOrTx, userId: string, postId: string): Promise<void> {
    await tx.like.deleteMany({ where: { userId, postId } });
  }

  async initializeCount(postId: string): Promise<void> {
    await this.redis.set(this.likeCountKey(postId), 0);
  }

  async getCount(tx: PrismaClientOrTx, postId: string): Promise<number> {
    const cached = await this.redis.get(this.likeCountKey(postId));
    if (cached !== null) {
      return Number(cached);
    }

    const count = await tx.like.count({ where: { postId } });
    await this.redis.set(this.likeCountKey(postId), count);
    return count;
  }

  async increment(postId: string): Promise<void> {
    await this.redis.incr(this.likeCountKey(postId));
  }

  async decrement(postId: string): Promise<void> {
    await this.redis.decr(this.likeCountKey(postId));
  }

  private likeCountKey(postId: string): string {
    return `post:${postId}:likes`;
  }
}
