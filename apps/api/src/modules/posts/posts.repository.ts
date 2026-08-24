import { Injectable } from '@nestjs/common';

import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

import { CreatePostRecordDto } from './dto/create-post-record.dto';
import { PostWithRelations } from './response/post.response';

export const POST_INCLUDE = {
  author: true,
  hashtags: { include: { hashtag: true } },
  media: { orderBy: { order: 'asc' } },
} as const;

@Injectable()
export class PostsRepository {
  findById(tx: PrismaClientOrTx, id: string): Promise<PostWithRelations | null> {
    return tx.post.findUnique({ where: { id }, include: POST_INCLUDE });
  }

  findDepthById(
    tx: PrismaClientOrTx,
    id: string,
  ): Promise<{ depth: number; authorId: string } | null> {
    return tx.post.findUnique({ where: { id }, select: { depth: true, authorId: true } });
  }

  create(tx: PrismaClientOrTx, data: CreatePostRecordDto): Promise<PostWithRelations> {
    return tx.post.create({
      data: {
        authorId: data.authorId,
        content: data.content,
        parentId: data.parentId,
        depth: data.depth,
        hashtags: { create: data.hashtagIds.map((hashtagId) => ({ hashtagId })) },
      },
      include: POST_INCLUDE,
    });
  }

  async incrementReplyCount(tx: PrismaClientOrTx, postId: string): Promise<void> {
    await tx.post.update({ where: { id: postId }, data: { replyCount: { increment: 1 } } });
  }

  findReplies(
    tx: PrismaClientOrTx,
    parentId: string,
    afterMs: number | undefined,
    limit: number,
  ): Promise<PostWithRelations[]> {
    return tx.post.findMany({
      where: {
        parentId,
        ...(afterMs !== undefined ? { createdAt: { gt: new Date(afterMs) } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: POST_INCLUDE,
    });
  }

  findByAuthor(
    tx: PrismaClientOrTx,
    authorId: string,
    beforeMs: number | undefined,
    limit: number,
  ): Promise<PostWithRelations[]> {
    return tx.post.findMany({
      where: {
        authorId,
        parentId: null,
        ...(beforeMs !== undefined ? { createdAt: { lt: new Date(beforeMs) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: POST_INCLUDE,
    });
  }

  findRepliesByAuthor(
    tx: PrismaClientOrTx,
    authorId: string,
    beforeMs: number | undefined,
    limit: number,
  ): Promise<PostWithRelations[]> {
    return tx.post.findMany({
      where: {
        authorId,
        parentId: { not: null },
        ...(beforeMs !== undefined ? { createdAt: { lt: new Date(beforeMs) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: POST_INCLUDE,
    });
  }

  async findFollowedAuthorIds(
    tx: PrismaClientOrTx,
    viewerId: string,
    authorIds: string[],
  ): Promise<Set<string>> {
    const uniqueIds = [...new Set(authorIds)].filter((id) => id !== viewerId);
    if (uniqueIds.length === 0) {
      return new Set();
    }

    const follows = await tx.follow.findMany({
      where: { followerId: viewerId, followeeId: { in: uniqueIds } },
      select: { followeeId: true },
    });
    return new Set(follows.map((f) => f.followeeId));
  }

  async isBlockedEitherDirection(
    tx: PrismaClientOrTx,
    userIdA: string,
    userIdB: string,
  ): Promise<boolean> {
    const block = await tx.block.findFirst({
      where: {
        OR: [
          { blockerId: userIdA, blockedId: userIdB },
          { blockerId: userIdB, blockedId: userIdA },
        ],
      },
    });
    return block !== null;
  }

  async isPrivateAndNotFollowing(
    tx: PrismaClientOrTx,
    viewerId: string,
    authorId: string,
  ): Promise<boolean> {
    if (viewerId === authorId) {
      return false;
    }

    const author = await tx.user.findUnique({
      where: { id: authorId },
      select: { isPrivate: true },
    });
    if (!author?.isPrivate) {
      return false;
    }

    const follow = await tx.follow.findUnique({
      where: { followerId_followeeId: { followerId: viewerId, followeeId: authorId } },
    });
    return follow === null;
  }

  async findBlockedAuthorIds(
    tx: PrismaClientOrTx,
    viewerId: string,
    authorIds: string[],
  ): Promise<Set<string>> {
    const uniqueIds = [...new Set(authorIds)].filter((id) => id !== viewerId);
    if (uniqueIds.length === 0) {
      return new Set();
    }

    const blocks = await tx.block.findMany({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: { in: uniqueIds } },
          { blockedId: viewerId, blockerId: { in: uniqueIds } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    });
    return new Set(blocks.map((b) => (b.blockerId === viewerId ? b.blockedId : b.blockerId)));
  }
}
