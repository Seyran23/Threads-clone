import type { SearchResults } from '@threads-clone/shared-types';

import { apiFetch } from './client';

export function search(q: string, page = 1): Promise<SearchResults> {
  const query = new URLSearchParams({ q, page: String(page) });
  return apiFetch<SearchResults>(`/search?${query.toString()}`);
}
