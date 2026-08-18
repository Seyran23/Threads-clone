import { User } from '@/generated/prisma';

export interface UserProfileFlags {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  hasPendingRequest: boolean;
  canViewPosts: boolean;
}

export class UserProfileResponse {
  id!: string;
  username!: string;
  avatarUrl!: string | null;
  isPrivate!: boolean;
  createdAt!: Date;
  followerCount!: number;
  followingCount!: number;
  isFollowing!: boolean;
  hasPendingRequest!: boolean;
  canViewPosts!: boolean;

  static from(user: User, flags: UserProfileFlags): UserProfileResponse {
    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      isPrivate: user.isPrivate,
      createdAt: user.createdAt,
      followerCount: flags.followerCount,
      followingCount: flags.followingCount,
      isFollowing: flags.isFollowing,
      hasPendingRequest: flags.hasPendingRequest,
      canViewPosts: flags.canViewPosts,
    };
  }
}
