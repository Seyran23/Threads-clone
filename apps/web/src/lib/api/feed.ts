import type { FeedPage } from '@threads-clone/shared-types';

import { apiFetch } from './client';
import type { GetFeedParams } from './feed.types';

export function getFeed(params: GetFeedParams = {}): Promise<FeedPage> {
  const query = new URLSearchParams();
  if (params.cursor) {
    query.set('cursor', params.cursor);
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }

  const queryString = query.toString();
  return apiFetch<FeedPage>(`/feed${queryString ? `?${queryString}` : ''}`);
}
