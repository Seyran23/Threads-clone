import { User } from '@/generated/prisma';

export class UserProfileResponse {
  id!: string;
  username!: string;
  avatarUrl!: string | null;
  createdAt!: Date;
  followerCount!: number;
  followingCount!: number;
  isFollowing!: boolean;

  static from(
    user: User,
    followerCount: number,
    followingCount: number,
    isFollowing: boolean,
  ): UserProfileResponse {
    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      followerCount,
      followingCount,
      isFollowing,
    };
  }
}
