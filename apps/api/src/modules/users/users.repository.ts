import { Injectable } from '@nestjs/common';

import { User } from '@/generated/prisma';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRecordDto } from './dto/update-user-record.dto';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: CreateUserDto): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: UpdateUserRecordDto): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  countFollowers(userId: string): Promise<number> {
    return this.prisma.follow.count({ where: { followeeId: userId } });
  }

  countFollowing(userId: string): Promise<number> {
    return this.prisma.follow.count({ where: { followerId: userId } });
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId, followeeId } },
    });
    return follow !== null;
  }

  async isBlockedEitherDirection(userIdA: string, userIdB: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userIdA, blockedId: userIdB },
          { blockerId: userIdB, blockedId: userIdA },
        ],
      },
    });
    return block !== null;
  }

  async hasPendingFollowRequest(requesterId: string, targetId: string): Promise<boolean> {
    const request = await this.prisma.followRequest.findUnique({
      where: { requesterId_targetId: { requesterId, targetId } },
    });
    return request !== null;
  }
}
