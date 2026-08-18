export interface FollowResult {
  following: boolean;
  requested: boolean;
}

export interface FollowRequest {
  id: string;
  username: string;
  avatarUrl: string | null;
  requestedAt: string;
}
