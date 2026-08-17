import type { User } from './user';

export interface PostSearchResult {
  id: string;
  content: string;
  authorId: string;
  authorUsername: string;
  createdAt: string;
}

export interface SearchResults {
  posts: PostSearchResult[];
  users: User[];
}
