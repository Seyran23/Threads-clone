import type { GraphUser } from '@threads-clone/shared-types';

import { apiFetch } from './client';

export function getSuggestedUsers(userId: string): Promise<GraphUser[]> {
  return apiFetch<GraphUser[]>(`/graph/second-degree/${userId}`);
}
