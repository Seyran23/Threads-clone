import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { ConflictException, NotFoundException } from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { FollowsService } from '@/modules/follows/follows.service';
import { UsersService } from '@/modules/users/users.service';

import { BlocksRepository } from './blocks.repository';
import { BlockResponse } from './response/block.response';
import { BlockedUserResponse } from './response/blocked-user.response';

@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksRepository: BlocksRepository,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => FollowsService))
    private readonly followsService: FollowsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BlocksService.name);
  }

  async blockUser(blockerId: string, blockedId: string): Promise<BlockResponse> {
    if (blockerId === blockedId) {
      throw new ConflictException('You cannot block yourself');
    }

    const target = await this.usersService.findById(blockedId);
    if (!target) {
      throw new NotFoundException('User', blockedId);
    }

    const existing = await this.blocksRepository.findOne(this.prisma, blockerId, blockedId);
    if (existing) {
      throw new ConflictException('User is already blocked');
    }

    await this.blocksRepository.create(this.prisma, blockerId, blockedId);

    await this.followsService.unfollowUser(blockerId, blockedId);
    await this.followsService.unfollowUser(blockedId, blockerId);

    this.logger.info({ blockerId, blockedId }, 'User blocked');
    return { blocked: true };
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<BlockResponse> {
    await this.blocksRepository.delete(this.prisma, blockerId, blockedId);
    this.logger.info({ blockerId, blockedId }, 'User unblocked');
    return { blocked: false };
  }

  getBlockedUsers(blockerId: string): Promise<BlockedUserResponse[]> {
    return this.blocksRepository.findBlockedUsers(this.prisma, blockerId);
  }

  isBlockedEitherDirection(userIdA: string, userIdB: string): Promise<boolean> {
    return this.blocksRepository.isBlockedEitherDirection(this.prisma, userIdA, userIdB);
  }
}
