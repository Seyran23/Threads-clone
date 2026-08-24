import { Injectable } from '@nestjs/common';

import { Like } from '@/generated/prisma';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';
import { RedisService } from '@/infrastructure/redis/redis.service';

import { POST_INCLUDE } from './posts.repository';
import { PostWithRelations } from './response/post.response';

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

  async getCounts(postIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (postIds.length === 0) {
      return counts;
    }

    const values = await this.redis.mget(...postIds.map((id) => this.likeCountKey(id)));
    postIds.forEach((id, index) => counts.set(id, Number(values[index] ?? 0)));
    return counts;
  }

  async findLikedPostIds(
    tx: PrismaClientOrTx,
    userId: string,
    postIds: string[],
  ): Promise<Set<string>> {
    if (postIds.length === 0) {
      return new Set();
    }

    const likes = await tx.like.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    });
    return new Set(likes.map((like) => like.postId));
  }

  async findPostsLikedByUser(
    tx: PrismaClientOrTx,
    userId: string,
    beforeMs: number | undefined,
    limit: number,
  ): Promise<{ post: PostWithRelations; likedAt: Date }[]> {
    const rows = await tx.like.findMany({
      where: {
        userId,
        ...(beforeMs !== undefined ? { createdAt: { lt: new Date(beforeMs) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { post: { include: POST_INCLUDE } },
    });
    return rows.map((row) => ({ post: row.post, likedAt: row.createdAt }));
  }

  private likeCountKey(postId: string): string {
    return `post:${postId}:likes`;
  }
}
