import { Injectable } from '@nestjs/common';

import { Follow } from '@/generated/prisma';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

import { CreateFollowRecordDto } from './dto/create-follow-record.dto';

@Injectable()
export class FollowsRepository {
  create(tx: PrismaClientOrTx, data: CreateFollowRecordDto): Promise<Follow> {
    return tx.follow.create({
      data: { followerId: data.followerId, followeeId: data.followeeId },
    });
  }

  findOne(tx: PrismaClientOrTx, followerId: string, followeeId: string): Promise<Follow | null> {
    return tx.follow.findUnique({
      where: { followerId_followeeId: { followerId, followeeId } },
    });
  }

  async delete(tx: PrismaClientOrTx, followerId: string, followeeId: string): Promise<void> {
    await tx.follow.deleteMany({ where: { followerId, followeeId } });
  }
}
