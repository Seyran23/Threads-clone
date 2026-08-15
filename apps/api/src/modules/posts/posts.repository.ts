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
}
