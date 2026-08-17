import { PostResponse } from '@/modules/posts/response/post.response';

export class UserPostsResponse {
  items!: PostResponse[];
  nextCursor!: string | null;
}
