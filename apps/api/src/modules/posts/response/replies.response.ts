import { PostResponse } from './post.response';

export class RepliesResponse {
  items!: PostResponse[];
  nextCursor!: string | null;
}
