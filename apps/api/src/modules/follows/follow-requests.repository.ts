import { Injectable } from '@nestjs/common';

import { FollowRequest } from '@/generated/prisma';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

@Injectable()
export class FollowRequestsRepository {
  create(tx: PrismaClientOrTx, requesterId: string, targetId: string): Promise<FollowRequest> {
    return tx.followRequest.create({ data: { requesterId, targetId } });
  }

  findOne(
    tx: PrismaClientOrTx,
    requesterId: string,
    targetId: string,
  ): Promise<FollowRequest | null> {
    return tx.followRequest.findUnique({
      where: { requesterId_targetId: { requesterId, targetId } },
    });
  }

  async delete(tx: PrismaClientOrTx, requesterId: string, targetId: string): Promise<void> {
    await tx.followRequest.deleteMany({ where: { requesterId, targetId } });
  }

  async findByTarget(
    tx: PrismaClientOrTx,
    targetId: string,
  ): Promise<{ id: string; username: string; avatarUrl: string | null; requestedAt: Date }[]> {
    const requests = await tx.followRequest.findMany({
      where: { targetId },
      orderBy: { createdAt: 'desc' },
      include: { requester: { select: { id: true, username: true, avatarUrl: true } } },
    });
    return requests.map((r) => ({
      id: r.requester.id,
      username: r.requester.username,
      avatarUrl: r.requester.avatarUrl,
      requestedAt: r.createdAt,
    }));
  }
}
