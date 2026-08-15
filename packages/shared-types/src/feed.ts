import type { Post } from './post';

export interface FeedPage {
  items: Post[];
  nextCursor: string | null;
}
