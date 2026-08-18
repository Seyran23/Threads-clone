export interface UserProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  isPrivate: boolean;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  hasPendingRequest: boolean;
  canViewPosts: boolean;
}
