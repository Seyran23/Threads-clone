import type { PresignedUpload, UserPostsPage, UserProfile } from '@threads-clone/shared-types';

import { apiFetch } from './client';
import type { PresignUploadInput } from './media.types';
import type { GetUserPostsParams, UpdateProfileInput } from './users.types';

export function getUserProfile(username: string): Promise<UserProfile> {
  return apiFetch<UserProfile>(`/users/${username}`);
}

export function updateProfile(data: UpdateProfileInput): Promise<UserProfile> {
  return apiFetch<UserProfile>('/users/me', { method: 'PATCH', body: data });
}

export function presignAvatarUpload(data: PresignUploadInput): Promise<PresignedUpload> {
  return apiFetch<PresignedUpload>('/users/me/avatar/presign-upload', {
    method: 'POST',
    body: data,
  });
}

export function getUserPosts(
  username: string,
  params: GetUserPostsParams = {},
): Promise<UserPostsPage> {
  const query = new URLSearchParams();
  if (params.cursor) {
    query.set('cursor', params.cursor);
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }

  const queryString = query.toString();
  return apiFetch<UserPostsPage>(`/users/${username}/posts${queryString ? `?${queryString}` : ''}`);
}

export function getSavedPosts(params: GetUserPostsParams = {}): Promise<UserPostsPage> {
  const query = new URLSearchParams();
  if (params.cursor) {
    query.set('cursor', params.cursor);
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }

  const queryString = query.toString();
  return apiFetch<UserPostsPage>(`/users/me/saved-posts${queryString ? `?${queryString}` : ''}`);
}
