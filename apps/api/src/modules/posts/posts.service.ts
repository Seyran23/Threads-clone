import { Injectable } from '@nestjs/common';

import { ConflictException, NotFoundException } from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';
import { MediaRepository } from '@/modules/media/media.repository';
import { MediaService } from '@/modules/media/media.service';

import { CreatePostDto } from './dto/create-post.dto';
import { HashtagsRepository } from './hashtags.repository';
import { LikesRepository } from './likes.repository';
import { PostsRepository } from './posts.repository';
import { LikeResponse } from './response/like.response';
import { PostResponse, PostWithRelations } from './response/post.response';
import { extractHashtags } from './utils/hashtag.util';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsRepository: PostsRepository,
    private readonly hashtagsRepository: HashtagsRepository,
    private readonly likesRepository: LikesRepository,
    private readonly mediaService: MediaService,
    private readonly mediaRepository: MediaRepository,
  ) {}

  async createPost(authorId: string, dto: CreatePostDto): Promise<PostResponse> {
    const hashtagIds = await this.resolveHashtagIds(this.prisma, dto.content);
    const mediaKeys = dto.mediaKeys ?? [];
    this.mediaService.assertOwnedByUser(authorId, mediaKeys);

    const post = await this.prisma.$transaction(async (tx) => {
      const created = await this.postsRepository.create(tx, {
        authorId,
        content: dto.content,
        depth: 0,
        hashtagIds,
      });
      await this.likesRepository.initializeCount(created.id);
      await this.attachMedia(tx, created.id, mediaKeys);
      return this.refetchWithMedia(tx, created.id);
    });

    return PostResponse.from(post, 0);
  }

  async createReply(authorId: string, parentId: string, dto: CreatePostDto): Promise<PostResponse> {
    const parent = await this.postsRepository.findDepthById(this.prisma, parentId);
    if (!parent) {
      throw new NotFoundException('Post', parentId);
    }

    const hashtagIds = await this.resolveHashtagIds(this.prisma, dto.content);
    const mediaKeys = dto.mediaKeys ?? [];
    this.mediaService.assertOwnedByUser(authorId, mediaKeys);

    const post = await this.prisma.$transaction(async (tx) => {
      const created = await this.postsRepository.create(tx, {
        authorId,
        content: dto.content,
        parentId,
        depth: parent.depth + 1,
        hashtagIds,
      });
      await this.likesRepository.initializeCount(created.id);
      await this.attachMedia(tx, created.id, mediaKeys);
      return this.refetchWithMedia(tx, created.id);
    });

    return PostResponse.from(post, 0);
  }

  async getPost(id: string): Promise<PostResponse> {
    const post = await this.postsRepository.findById(this.prisma, id);
    if (!post) {
      throw new NotFoundException('Post', id);
    }

    const likeCount = await this.likesRepository.getCount(this.prisma, id);
    return PostResponse.from(post, likeCount);
  }

  async likePost(userId: string, postId: string): Promise<LikeResponse> {
    const post = await this.postsRepository.findDepthById(this.prisma, postId);
    if (!post) {
      throw new NotFoundException('Post', postId);
    }

    const existing = await this.likesRepository.findOne(this.prisma, userId, postId);
    if (existing) {
      throw new ConflictException('Post is already liked');
    }

    await this.likesRepository.create(this.prisma, userId, postId);
    await this.likesRepository.increment(postId);

    const likeCount = await this.likesRepository.getCount(this.prisma, postId);
    return { liked: true, likeCount };
  }

  async unlikePost(userId: string, postId: string): Promise<LikeResponse> {
    const existing = await this.likesRepository.findOne(this.prisma, userId, postId);
    if (existing) {
      await this.likesRepository.delete(this.prisma, userId, postId);
      await this.likesRepository.decrement(postId);
    }

    const likeCount = await this.likesRepository.getCount(this.prisma, postId);
    return { liked: false, likeCount };
  }

  private async resolveHashtagIds(tx: PrismaClientOrTx, content: string): Promise<string[]> {
    const tags = extractHashtags(content);

    if (tags.length === 0) {
      return [];
    }

    const hashtags = await this.hashtagsRepository.findOrCreateMany(tx, tags);

    return hashtags.map((hashtag) => hashtag.id);
  }

  private async attachMedia(
    tx: PrismaClientOrTx,
    postId: string,
    mediaKeys: string[],
  ): Promise<void> {
    for (const [index, s3Key] of mediaKeys.entries()) {
      await this.mediaRepository.create(tx, {
        postId,
        s3Key,
        url: this.mediaService.getPublicUrl(s3Key),
        order: index,
      });
    }
  }

  private async refetchWithMedia(tx: PrismaClientOrTx, postId: string): Promise<PostWithRelations> {
    const post = await this.postsRepository.findById(tx, postId);
    return post!;
  }
}
