import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { PostResponse } from '@/modules/posts/response/post.response';

import { FeedRepository } from './feed.repository';
import { FeedResponse } from './response/feed.response';
import { decodeFeedCursor, encodeFeedCursor } from './utils/feed-cursor.util';
import { mergeFeedEntries } from './utils/merge-feed-entries.util';

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feedRepository: FeedRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FeedService.name);
  }

  async getFeed(
    viewerId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<FeedResponse> {
    const beforeMs = decodeFeedCursor(cursor);

    const celebrityIds = await this.feedRepository.findCelebrityFolloweeIds(this.prisma, viewerId);
    const [fannedOutEntries, celebrityEntries] = await Promise.all([
      this.feedRepository.getFeedEntries(viewerId, beforeMs, limit),
      this.feedRepository.findCelebrityPostEntries(this.prisma, celebrityIds, beforeMs, limit),
    ]);

    const merged = mergeFeedEntries(fannedOutEntries, celebrityEntries, limit);
    const postIds = merged.map((entry) => entry.postId);

    const [posts, likeCounts, likedPostIds, savedPostIds] = await Promise.all([
      this.feedRepository.findManyByIds(this.prisma, postIds),
      this.feedRepository.getLikeCounts(postIds),
      this.feedRepository.getLikedPostIds(this.prisma, viewerId, postIds),
      this.feedRepository.getSavedPostIds(this.prisma, viewerId, postIds),
    ]);
    const postsById = new Map(posts.map((post) => [post.id, post]));
    const authorIds = posts.map((post) => post.authorId);
    const [followedAuthorIds, blockedAuthorIds] = await Promise.all([
      this.feedRepository.getFollowedAuthorIds(this.prisma, viewerId, authorIds),
      this.feedRepository.getBlockedAuthorIds(this.prisma, viewerId, authorIds),
    ]);

    const items = merged
      .filter((entry) => postsById.has(entry.postId))
      .filter((entry) => !blockedAuthorIds.has(postsById.get(entry.postId)!.authorId))
      .map((entry) => {
        const post = postsById.get(entry.postId)!;
        return PostResponse.from(post, {
          likeCount: likeCounts.get(entry.postId) ?? 0,
          isLiked: likedPostIds.has(entry.postId),
          isFollowing: followedAuthorIds.has(post.authorId),
          isSaved: savedPostIds.has(entry.postId),
        });
      });

    const hasMore =
      merged.length === limit &&
      (fannedOutEntries.length === limit || celebrityEntries.length === limit);
    const nextCursor = hasMore ? encodeFeedCursor(merged[merged.length - 1].score) : null;

    this.logger.info({ viewerId, count: items.length, hasMore }, 'Feed page read');
    return { items, nextCursor };
  }
}
