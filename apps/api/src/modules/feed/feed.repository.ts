import { Injectable } from '@nestjs/common';

import { Post } from '@/generated/prisma';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { POST_INCLUDE } from '@/modules/posts/posts.repository';
import { PostWithRelations } from '@/modules/posts/response/post.response';

import {
  FANOUT_STUCK_THRESHOLD_MS,
  FEED_MAX_SIZE,
  HYBRID_FANOUT_FOLLOWER_THRESHOLD,
} from './fanout/fanout.constants';
import { FeedEntry } from './interface/feed-entry.interface';

@Injectable()
export class FeedRepository {
  constructor(private readonly redis: RedisService) {}

  async pushToFeed(userId: string, postId: string, score: number): Promise<void> {
    const key = this.feedKey(userId);
    await this.redis.zadd(key, score, postId);
    await this.redis.zremrangebyrank(key, 0, -(FEED_MAX_SIZE + 1));
  }

  countFollowers(tx: PrismaClientOrTx, authorId: string): Promise<number> {
    return tx.follow.count({ where: { followeeId: authorId } });
  }

  async findFollowerIds(tx: PrismaClientOrTx, authorId: string): Promise<string[]> {
    const follows = await tx.follow.findMany({
      where: { followeeId: authorId },
      select: { followerId: true },
    });
    return follows.map((follow) => follow.followerId);
  }

  markFanoutCompleted(tx: PrismaClientOrTx, postId: string): Promise<Post> {
    return tx.post.update({ where: { id: postId }, data: { fanoutStatus: 'COMPLETED' } });
  }

  findStuckPendingFanout(tx: PrismaClientOrTx): Promise<Post[]> {
    return tx.post.findMany({
      where: {
        parentId: null,
        fanoutStatus: 'PENDING',
        createdAt: { lt: new Date(Date.now() - FANOUT_STUCK_THRESHOLD_MS) },
      },
    });
  }

  async getFeedEntries(
    userId: string,
    beforeMs: number | undefined,
    limit: number,
  ): Promise<FeedEntry[]> {
    const max = beforeMs !== undefined ? `(${beforeMs}` : '+inf';
    const raw = await this.redis.zrevrangebyscore(
      this.feedKey(userId),
      max,
      '-inf',
      'WITHSCORES',
      'LIMIT',
      0,
      limit,
    );

    const entries: FeedEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({ postId: raw[i], score: Number(raw[i + 1]) });
    }
    return entries;
  }

  async findCelebrityFolloweeIds(tx: PrismaClientOrTx, viewerId: string): Promise<string[]> {
    const followed = await tx.follow.findMany({
      where: { followerId: viewerId },
      select: { followeeId: true },
    });
    if (followed.length === 0) {
      return [];
    }

    const grouped = await tx.follow.groupBy({
      by: ['followeeId'],
      where: { followeeId: { in: followed.map((f) => f.followeeId) } },
      _count: { followerId: true },
      having: { followerId: { _count: { gt: HYBRID_FANOUT_FOLLOWER_THRESHOLD } } },
    });
    return grouped.map((g) => g.followeeId);
  }

  async findCelebrityPostEntries(
    tx: PrismaClientOrTx,
    authorIds: string[],
    beforeMs: number | undefined,
    limit: number,
  ): Promise<FeedEntry[]> {
    if (authorIds.length === 0) {
      return [];
    }

    const posts = await tx.post.findMany({
      where: {
        authorId: { in: authorIds },
        parentId: null,
        ...(beforeMs !== undefined ? { createdAt: { lt: new Date(beforeMs) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, createdAt: true },
    });
    return posts.map((post) => ({ postId: post.id, score: post.createdAt.getTime() }));
  }

  findManyByIds(tx: PrismaClientOrTx, ids: string[]): Promise<PostWithRelations[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return tx.post.findMany({ where: { id: { in: ids } }, include: POST_INCLUDE });
  }

  async getLikeCounts(ids: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (ids.length === 0) {
      return counts;
    }

    const values = await this.redis.mget(...ids.map((id) => this.likeCountKey(id)));
    ids.forEach((id, index) => counts.set(id, Number(values[index] ?? 0)));
    return counts;
  }

  private feedKey(userId: string): string {
    return `feed:${userId}`;
  }

  private likeCountKey(postId: string): string {
    return `post:${postId}:likes`;
  }
}
