import type { BlockedUser, BlockResult } from '@threads-clone/shared-types';

import { apiFetch } from './client';

export function getBlockedUsers(): Promise<BlockedUser[]> {
  return apiFetch<BlockedUser[]>('/blocks');
}

export function blockUser(userId: string): Promise<BlockResult> {
  return apiFetch<BlockResult>(`/blocks/${userId}`, { method: 'POST' });
}

export function unblockUser(userId: string): Promise<BlockResult> {
  return apiFetch<BlockResult>(`/blocks/${userId}`, { method: 'DELETE' });
}
