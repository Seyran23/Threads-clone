import type { FollowRequest, FollowResult } from '@threads-clone/shared-types';

import { apiFetch } from './client';

export function followUser(userId: string): Promise<FollowResult> {
  return apiFetch<FollowResult>(`/follows/${userId}`, { method: 'POST' });
}

export function unfollowUser(userId: string): Promise<FollowResult> {
  return apiFetch<FollowResult>(`/follows/${userId}`, { method: 'DELETE' });
}

export function getFollowRequests(): Promise<FollowRequest[]> {
  return apiFetch<FollowRequest[]>('/follows/requests');
}

export function acceptFollowRequest(userId: string): Promise<void> {
  return apiFetch<void>(`/follows/requests/${userId}/accept`, { method: 'POST' });
}

export function rejectFollowRequest(userId: string): Promise<void> {
  return apiFetch<void>(`/follows/requests/${userId}/reject`, { method: 'POST' });
}
