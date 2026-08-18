export interface GetUserPostsParams {
  cursor?: string;
  limit?: number;
}

export interface UpdateProfileInput {
  username?: string;
  avatarKey?: string;
  isPrivate?: boolean;
}
