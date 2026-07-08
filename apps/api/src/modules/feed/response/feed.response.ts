import { PostResponse } from '@/modules/posts/response/post.response';

export class FeedResponse {
  items!: PostResponse[];
  nextCursor!: string | null;
}
