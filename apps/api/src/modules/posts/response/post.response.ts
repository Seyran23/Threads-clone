import { Hashtag, Post, PostHashtag, User } from '@/generated/prisma';
import { UserResponse } from '@/modules/users/response/user.response';

export type PostWithRelations = Post & {
  author: User;
  hashtags: (PostHashtag & { hashtag: Hashtag })[];
};

export class PostResponse {
  id!: string;
  author!: UserResponse;
  content!: string;
  parentId!: string | null;
  depth!: number;
  likeCount!: number;
  hashtags!: string[];
  createdAt!: Date;
  updatedAt!: Date;

  static from(post: PostWithRelations, likeCount: number): PostResponse {
    return {
      id: post.id,
      author: UserResponse.from(post.author),
      content: post.content,
      parentId: post.parentId,
      depth: post.depth,
      likeCount,
      hashtags: post.hashtags.map((h) => h.hashtag.tag),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
