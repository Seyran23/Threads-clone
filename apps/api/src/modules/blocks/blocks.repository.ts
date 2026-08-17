import { Injectable } from '@nestjs/common';

import { Block } from '@/generated/prisma';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

@Injectable()
export class BlocksRepository {
  create(tx: PrismaClientOrTx, blockerId: string, blockedId: string): Promise<Block> {
    return tx.block.create({ data: { blockerId, blockedId } });
  }

  findOne(tx: PrismaClientOrTx, blockerId: string, blockedId: string): Promise<Block | null> {
    return tx.block.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } } });
  }

  async delete(tx: PrismaClientOrTx, blockerId: string, blockedId: string): Promise<void> {
    await tx.block.deleteMany({ where: { blockerId, blockedId } });
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

  async findBlockedUsers(
    tx: PrismaClientOrTx,
    blockerId: string,
  ): Promise<{ id: string; username: string; avatarUrl: string | null; blockedAt: Date }[]> {
    const blocks = await tx.block.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      include: { blocked: { select: { id: true, username: true, avatarUrl: true } } },
    });
    return blocks.map((b) => ({
      id: b.blocked.id,
      username: b.blocked.username,
      avatarUrl: b.blocked.avatarUrl,
      blockedAt: b.createdAt,
    }));
  }
}
