import { Injectable } from '@nestjs/common';

import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

import { POST_INCLUDE } from './posts.repository';
import { PostWithRelations } from './response/post.response';

@Injectable()
export class SavedPostsRepository {
  async save(tx: PrismaClientOrTx, userId: string, postId: string): Promise<void> {
    await tx.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });
  }

  async unsave(tx: PrismaClientOrTx, userId: string, postId: string): Promise<void> {
    await tx.savedPost.deleteMany({ where: { userId, postId } });
  }

  async findSavedPostIds(
    tx: PrismaClientOrTx,
    userId: string,
    postIds: string[],
  ): Promise<Set<string>> {
    if (postIds.length === 0) {
      return new Set();
    }

    const saved = await tx.savedPost.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    });
    return new Set(saved.map((s) => s.postId));
  }

  async findByUser(
    tx: PrismaClientOrTx,
    userId: string,
    beforeMs: number | undefined,
    limit: number,
  ): Promise<{ post: PostWithRelations; savedAt: Date }[]> {
    const rows = await tx.savedPost.findMany({
      where: {
        userId,
        ...(beforeMs !== undefined ? { createdAt: { lt: new Date(beforeMs) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { post: { include: POST_INCLUDE } },
    });
    return rows.map((row) => ({ post: row.post, savedAt: row.createdAt }));
  }
}
