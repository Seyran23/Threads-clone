import type { FollowResult } from '@threads-clone/shared-types';

import { apiFetch } from './client';

export function followUser(userId: string): Promise<FollowResult> {
  return apiFetch<FollowResult>(`/follows/${userId}`, { method: 'POST' });
}

export function unfollowUser(userId: string): Promise<FollowResult> {
  return apiFetch<FollowResult>(`/follows/${userId}`, { method: 'DELETE' });
}
