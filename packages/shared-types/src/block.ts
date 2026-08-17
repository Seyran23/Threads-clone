export interface BlockedUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  blockedAt: string;
}

export interface BlockResult {
  blocked: boolean;
}
