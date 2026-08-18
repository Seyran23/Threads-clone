import type {
  GraphUser,
  GraphViewData,
  InfluenceResult,
  ShortestPathResult,
} from '@threads-clone/shared-types';

import { apiFetch } from './client';

export function getSuggestedUsers(userId: string): Promise<GraphUser[]> {
  return apiFetch<GraphUser[]>(`/graph/second-degree/${userId}`);
}

export function getGraphView(userId: string): Promise<GraphViewData> {
  return apiFetch<GraphViewData>(`/graph/view/${userId}`);
}

export function getMutuals(targetUserId: string): Promise<GraphUser[]> {
  return apiFetch<GraphUser[]>(`/graph/mutuals/${targetUserId}`);
}

export function getShortestPath(targetUserId: string): Promise<ShortestPathResult> {
  return apiFetch<ShortestPathResult>(`/graph/shortest-path/${targetUserId}`);
}

export function getInfluence(userId: string): Promise<InfluenceResult> {
  return apiFetch<InfluenceResult>(`/graph/influence/${userId}`);
}
