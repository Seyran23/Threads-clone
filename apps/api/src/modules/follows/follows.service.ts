import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { ConflictException, NotFoundException } from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { UsersService } from '@/modules/users/users.service';

import { FollowsRepository } from './follows.repository';
import { GraphSyncOutboxRepository } from './graph-sync/graph-sync-outbox.repository';
import { GraphSyncQueue } from './graph-sync/queue/graph-sync.queue';
import { FollowResponse } from './response/follow.response';

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly followsRepository: FollowsRepository,
    private readonly graphSyncOutboxRepository: GraphSyncOutboxRepository,
    private readonly graphSyncQueue: GraphSyncQueue,
    private readonly usersService: UsersService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FollowsService.name);
  }

  async followUser(followerId: string, followeeId: string): Promise<FollowResponse> {
    if (followerId === followeeId) {
      throw new ConflictException('You cannot follow yourself');
    }

    const followee = await this.usersService.findById(followeeId);
    if (!followee) {
      throw new NotFoundException('User', followeeId);
    }

    const existing = await this.followsRepository.findOne(this.prisma, followerId, followeeId);
    if (existing) {
      throw new ConflictException('Already following this user');
    }

    const outbox = await this.prisma.$transaction(async (tx) => {
      await this.followsRepository.create(tx, { followerId, followeeId });
      return this.graphSyncOutboxRepository.create(tx, {
        eventType: 'FOLLOW_CREATED',
        payload: { followerId, followeeId },
      });
    });
    await this.graphSyncQueue.enqueueSyncEvent(outbox.id);

    this.logger.info({ followerId, followeeId }, 'User followed');
    return { following: true };
  }

  async unfollowUser(followerId: string, followeeId: string): Promise<FollowResponse> {
    const existing = await this.followsRepository.findOne(this.prisma, followerId, followeeId);

    if (existing) {
      const outbox = await this.prisma.$transaction(async (tx) => {
        await this.followsRepository.delete(tx, followerId, followeeId);
        return this.graphSyncOutboxRepository.create(tx, {
          eventType: 'FOLLOW_DELETED',
          payload: { followerId, followeeId },
        });
      });
      await this.graphSyncQueue.enqueueSyncEvent(outbox.id);
      this.logger.info({ followerId, followeeId }, 'User unfollowed');
    }

    return { following: false };
  }
}
