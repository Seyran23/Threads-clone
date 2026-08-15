export interface CreatePostInput {
  content: string;
  mediaKeys?: string[];
}

export interface GetRepliesParams {
  cursor?: string;
  limit?: number;
}
