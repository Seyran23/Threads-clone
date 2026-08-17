import { Hashtag, Media, Post, PostHashtag, User } from '@/generated/prisma';
import { MediaResponse } from '@/modules/media/response/media.response';
import { UserResponse } from '@/modules/users/response/user.response';

export type PostWithRelations = Post & {
  author: User;
  hashtags: (PostHashtag & { hashtag: Hashtag })[];
  media: Media[];
};

export interface PostResponseFlags {
  likeCount: number;
  isLiked: boolean;
  isFollowing: boolean;
  isSaved: boolean;
}

export class PostResponse {
  id!: string;
  author!: UserResponse;
  content!: string;
  parentId!: string | null;
  depth!: number;
  likeCount!: number;
  isLiked!: boolean;
  replyCount!: number;
  isFollowing!: boolean;
  isSaved!: boolean;
  hashtags!: string[];
  media!: MediaResponse[];
  createdAt!: Date;
  updatedAt!: Date;

  static from(post: PostWithRelations, flags: PostResponseFlags): PostResponse {
    return {
      id: post.id,
      author: UserResponse.from(post.author),
      content: post.content,
      parentId: post.parentId,
      depth: post.depth,
      likeCount: flags.likeCount,
      isLiked: flags.isLiked,
      replyCount: post.replyCount,
      isFollowing: flags.isFollowing,
      isSaved: flags.isSaved,
      hashtags: post.hashtags.map((h) => h.hashtag.tag),
      media: post.media.map((m) => MediaResponse.from(m)),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
