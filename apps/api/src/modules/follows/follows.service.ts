import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { BlocksService } from '@/modules/blocks/blocks.service';
import { NotificationDeliveryQueue } from '@/modules/notifications/delivery/queue/notification-delivery.queue';
import { NotificationsRepository } from '@/modules/notifications/notifications.repository';
import { UsersService } from '@/modules/users/users.service';

import { FollowRequestsRepository } from './follow-requests.repository';
import { FollowsRepository } from './follows.repository';
import { GraphSyncOutboxRepository } from './graph-sync/graph-sync-outbox.repository';
import { GraphSyncQueue } from './graph-sync/queue/graph-sync.queue';
import { FollowRequestResponse } from './response/follow-request.response';
import { FollowResponse } from './response/follow.response';

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly followsRepository: FollowsRepository,
    private readonly followRequestsRepository: FollowRequestsRepository,
    private readonly graphSyncOutboxRepository: GraphSyncOutboxRepository,
    private readonly graphSyncQueue: GraphSyncQueue,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly notificationDeliveryQueue: NotificationDeliveryQueue,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => BlocksService))
    private readonly blocksService: BlocksService,
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

    const isBlocked = await this.blocksService.isBlockedEitherDirection(followerId, followeeId);
    if (isBlocked) {
      throw new ForbiddenException('You cannot follow this user');
    }

    const existing = await this.followsRepository.findOne(this.prisma, followerId, followeeId);
    if (existing) {
      throw new ConflictException('Already following this user');
    }

    if (followee.isPrivate) {
      return this.createFollowRequest(followerId, followeeId);
    }

    const { outboxId, notification } = await this.prisma.$transaction(async (tx) => {
      await this.followsRepository.create(tx, { followerId, followeeId });
      const outbox = await this.graphSyncOutboxRepository.create(tx, {
        eventType: 'FOLLOW_CREATED',
        payload: { followerId, followeeId },
      });
      const notification = await this.notificationsRepository.createIfNotSelf(tx, {
        actorId: followerId,
        recipientId: followeeId,
        type: 'FOLLOW',
      });
      return { outboxId: outbox.id, notification };
    });

    await this.graphSyncQueue.enqueueSyncEvent(outboxId);

    if (notification) {
      await this.notificationDeliveryQueue.enqueueDelivery(notification.id);
    }

    this.logger.info({ followerId, followeeId }, 'User followed');
    return { following: true, requested: false };
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
      return { following: false, requested: false };
    }

    await this.followRequestsRepository.delete(this.prisma, followerId, followeeId);
    return { following: false, requested: false };
  }

  listFollowRequests(targetId: string): Promise<FollowRequestResponse[]> {
    return this.followRequestsRepository.findByTarget(this.prisma, targetId);
  }

  async acceptFollowRequest(targetId: string, requesterId: string): Promise<void> {
    const request = await this.followRequestsRepository.findOne(this.prisma, requesterId, targetId);
    if (!request) {
      throw new NotFoundException('FollowRequest', requesterId);
    }

    const outbox = await this.prisma.$transaction(async (tx) => {
      await this.followRequestsRepository.delete(tx, requesterId, targetId);
      await this.followsRepository.create(tx, { followerId: requesterId, followeeId: targetId });
      return this.graphSyncOutboxRepository.create(tx, {
        eventType: 'FOLLOW_CREATED',
        payload: { followerId: requesterId, followeeId: targetId },
      });
    });

    await this.graphSyncQueue.enqueueSyncEvent(outbox.id);
    this.logger.info({ requesterId, targetId }, 'Follow request accepted');
  }

  async rejectFollowRequest(targetId: string, requesterId: string): Promise<void> {
    await this.followRequestsRepository.delete(this.prisma, requesterId, targetId);
    this.logger.info({ requesterId, targetId }, 'Follow request rejected');
  }

  private async createFollowRequest(
    requesterId: string,
    targetId: string,
  ): Promise<FollowResponse> {
    const existingRequest = await this.followRequestsRepository.findOne(
      this.prisma,
      requesterId,
      targetId,
    );
    if (existingRequest) {
      throw new ConflictException('Follow request already sent');
    }

    const notification = await this.prisma.$transaction(async (tx) => {
      await this.followRequestsRepository.create(tx, requesterId, targetId);
      return this.notificationsRepository.createIfNotSelf(tx, {
        actorId: requesterId,
        recipientId: targetId,
        type: 'FOLLOW_REQUEST',
      });
    });

    if (notification) {
      await this.notificationDeliveryQueue.enqueueDelivery(notification.id);
    }

    this.logger.info({ requesterId, targetId }, 'Follow request created');
    return { following: false, requested: true };
  }
}
