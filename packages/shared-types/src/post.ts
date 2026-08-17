import type { Media } from './media';
import type { User } from './user';

export interface Post {
  id: string;
  author: User;
  content: string;
  parentId: string | null;
  depth: number;
  likeCount: number;
  isLiked: boolean;
  replyCount: number;
  isFollowing: boolean;
  isSaved: boolean;
  hashtags: string[];
  media: Media[];
  createdAt: string;
  updatedAt: string;
}

export interface LikeResult {
  liked: boolean;
  likeCount: number;
}

export interface RepliesPage {
  items: Post[];
  nextCursor: string | null;
}

export interface UserPostsPage {
  items: Post[];
  nextCursor: string | null;
}
