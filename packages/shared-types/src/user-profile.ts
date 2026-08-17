export interface UserProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
}
