import type { LikeResult, Post, RepliesPage } from '@threads-clone/shared-types';

import { apiFetch } from './client';
import type { CreatePostInput, GetRepliesParams } from './posts.types';

export function createPost(data: CreatePostInput): Promise<Post> {
  return apiFetch<Post>('/posts', { method: 'POST', body: data });
}

export function createReply(parentId: string, data: CreatePostInput): Promise<Post> {
  return apiFetch<Post>(`/posts/${parentId}/replies`, { method: 'POST', body: data });
}

export function getPost(id: string): Promise<Post> {
  return apiFetch<Post>(`/posts/${id}`);
}

export function getReplies(parentId: string, params: GetRepliesParams = {}): Promise<RepliesPage> {
  const query = new URLSearchParams();
  if (params.cursor) {
    query.set('cursor', params.cursor);
  }

  if (params.limit) {
    query.set('limit', String(params.limit));
  }

  const queryString = query.toString();
  return apiFetch<RepliesPage>(`/posts/${parentId}/replies${queryString ? `?${queryString}` : ''}`);
}

export function likePost(id: string): Promise<LikeResult> {
  return apiFetch<LikeResult>(`/posts/${id}/like`, { method: 'POST' });
}

export function unlikePost(id: string): Promise<LikeResult> {
  return apiFetch<LikeResult>(`/posts/${id}/like`, { method: 'DELETE' });
}

export function savePost(id: string): Promise<void> {
  return apiFetch<void>(`/posts/${id}/save`, { method: 'POST' });
}

export function unsavePost(id: string): Promise<void> {
  return apiFetch<void>(`/posts/${id}/save`, { method: 'DELETE' });
}
