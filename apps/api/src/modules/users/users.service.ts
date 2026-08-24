import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@/common/exceptions/app.exception';
import { User } from '@/generated/prisma';
import { Neo4jService } from '@/infrastructure/neo4j/neo4j.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { S3Service } from '@/infrastructure/s3/s3.service';
import {
  EXTENSION_BY_CONTENT_TYPE,
  PRESIGN_EXPIRY_SECONDS,
} from '@/modules/media/constants/media.constants';
import { PresignUploadDto } from '@/modules/media/dto/presign-upload.dto';
import { PresignedUploadResponse } from '@/modules/media/response/presigned-upload.response';
import { LikesRepository } from '@/modules/posts/likes.repository';
import { PostsRepository } from '@/modules/posts/posts.repository';
import { PostResponse } from '@/modules/posts/response/post.response';
import { SavedPostsRepository } from '@/modules/posts/saved-posts.repository';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPostsResponse } from './response/user-posts.response';
import { UserProfileResponse } from './response/user-profile.response';
import { UsersRepository } from './users.repository';
import { decodeUserPostsCursor, encodeUserPostsCursor } from './utils/user-posts-cursor.util';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly postsRepository: PostsRepository,
    private readonly likesRepository: LikesRepository,
    private readonly savedPostsRepository: SavedPostsRepository,
    private readonly prisma: PrismaService,
    private readonly neo4j: Neo4jService,
    private readonly s3Service: S3Service,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UsersService.name);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findByUsername(username);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async createUser(data: CreateUserDto): Promise<User> {
    const [existingEmail, existingUsername] = await Promise.all([
      this.usersRepository.findByEmail(data.email),
      this.usersRepository.findByUsername(data.username),
    ]);

    if (existingEmail) {
      throw new ConflictException('Email is already registered');
    }
    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    const user = await this.usersRepository.create(data);

    try {
      await this.neo4j.run('CREATE (u:User {id: $id, username: $username})', {
        id: user.id,
        username: user.username,
      });
    } catch (error) {
      this.logger.error({ err: error, userId: user.id }, 'Failed to create Neo4j User node');
    }

    return user;
  }

  async getProfile(username: string, viewerId: string): Promise<UserProfileResponse> {
    const user = await this.usersRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundException('User', username);
    }

    const isOwnProfile = viewerId === user.id;

    if (!isOwnProfile) {
      const isBlocked = await this.usersRepository.isBlockedEitherDirection(viewerId, user.id);
      if (isBlocked) {
        throw new NotFoundException('User', username);
      }
    }

    const [followerCount, followingCount, isFollowing] = await Promise.all([
      this.usersRepository.countFollowers(user.id),
      this.usersRepository.countFollowing(user.id),
      isOwnProfile ? Promise.resolve(false) : this.usersRepository.isFollowing(viewerId, user.id),
    ]);

    const hasPendingRequest =
      isOwnProfile || !user.isPrivate
        ? false
        : await this.usersRepository.hasPendingFollowRequest(viewerId, user.id);

    return UserProfileResponse.from(user, {
      followerCount,
      followingCount,
      isFollowing,
      hasPendingRequest,
      canViewPosts: isOwnProfile || !user.isPrivate || isFollowing,
    });
  }

  async getUserPosts(
    username: string,
    viewerId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<UserPostsResponse> {
    const user = await this.usersRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundException('User', username);
    }

    const isOwnProfile = viewerId === user.id;

    if (!isOwnProfile) {
      const isBlocked = await this.usersRepository.isBlockedEitherDirection(viewerId, user.id);
      if (isBlocked) {
        throw new NotFoundException('User', username);
      }
    }

    const isFollowingAuthor = isOwnProfile
      ? false
      : await this.usersRepository.isFollowing(viewerId, user.id);

    if (user.isPrivate && !isOwnProfile && !isFollowingAuthor) {
      return { items: [], nextCursor: null };
    }

    const beforeMs = decodeUserPostsCursor(cursor);
    const posts = await this.postsRepository.findByAuthor(this.prisma, user.id, beforeMs, limit);
    const postIds = posts.map((post) => post.id);

    const [likeCounts, likedPostIds, savedPostIds] = await Promise.all([
      this.likesRepository.getCounts(postIds),
      this.likesRepository.findLikedPostIds(this.prisma, viewerId, postIds),
      this.savedPostsRepository.findSavedPostIds(this.prisma, viewerId, postIds),
    ]);

    const items = posts.map((post) =>
      PostResponse.from(post, {
        likeCount: likeCounts.get(post.id) ?? 0,
        isLiked: likedPostIds.has(post.id),
        isFollowing: isFollowingAuthor,
        isSaved: savedPostIds.has(post.id),
      }),
    );

    const hasMore = posts.length === limit;
    const nextCursor = hasMore
      ? encodeUserPostsCursor(posts[posts.length - 1].createdAt.getTime())
      : null;

    return { items, nextCursor };
  }

  async getUserReplies(
    username: string,
    viewerId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<UserPostsResponse> {
    const user = await this.usersRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundException('User', username);
    }

    const isOwnProfile = viewerId === user.id;

    if (!isOwnProfile) {
      const isBlocked = await this.usersRepository.isBlockedEitherDirection(viewerId, user.id);
      if (isBlocked) {
        throw new NotFoundException('User', username);
      }
    }

    const isFollowingAuthor = isOwnProfile
      ? false
      : await this.usersRepository.isFollowing(viewerId, user.id);

    if (user.isPrivate && !isOwnProfile && !isFollowingAuthor) {
      return { items: [], nextCursor: null };
    }

    const beforeMs = decodeUserPostsCursor(cursor);
    const replies = await this.postsRepository.findRepliesByAuthor(
      this.prisma,
      user.id,
      beforeMs,
      limit,
    );
    const replyIds = replies.map((reply) => reply.id);

    const [likeCounts, likedPostIds, savedPostIds] = await Promise.all([
      this.likesRepository.getCounts(replyIds),
      this.likesRepository.findLikedPostIds(this.prisma, viewerId, replyIds),
      this.savedPostsRepository.findSavedPostIds(this.prisma, viewerId, replyIds),
    ]);

    const items = replies.map((reply) =>
      PostResponse.from(reply, {
        likeCount: likeCounts.get(reply.id) ?? 0,
        isLiked: likedPostIds.has(reply.id),
        isFollowing: isFollowingAuthor,
        isSaved: savedPostIds.has(reply.id),
      }),
    );

    const hasMore = replies.length === limit;
    const nextCursor = hasMore
      ? encodeUserPostsCursor(replies[replies.length - 1].createdAt.getTime())
      : null;

    return { items, nextCursor };
  }

  async getSavedPosts(
    viewerId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<UserPostsResponse> {
    const beforeMs = decodeUserPostsCursor(cursor);
    const saved = await this.savedPostsRepository.findByUser(
      this.prisma,
      viewerId,
      beforeMs,
      limit,
    );
    const postIds = saved.map((row) => row.post.id);
    const authorIds = saved.map((row) => row.post.authorId);

    const [likeCounts, likedPostIds, followedAuthorIds, blockedAuthorIds] = await Promise.all([
      this.likesRepository.getCounts(postIds),
      this.likesRepository.findLikedPostIds(this.prisma, viewerId, postIds),
      this.postsRepository.findFollowedAuthorIds(this.prisma, viewerId, authorIds),
      this.postsRepository.findBlockedAuthorIds(this.prisma, viewerId, authorIds),
    ]);

    const items = saved
      .filter(({ post }) => !blockedAuthorIds.has(post.authorId))
      .map(({ post }) =>
        PostResponse.from(post, {
          likeCount: likeCounts.get(post.id) ?? 0,
          isLiked: likedPostIds.has(post.id),
          isFollowing: followedAuthorIds.has(post.authorId),
          isSaved: true,
        }),
      );

    const hasMore = saved.length === limit;
    const nextCursor = hasMore
      ? encodeUserPostsCursor(saved[saved.length - 1].savedAt.getTime())
      : null;

    return { items, nextCursor };
  }

  async getMyLikedPosts(
    viewerId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<UserPostsResponse> {
    const beforeMs = decodeUserPostsCursor(cursor);
    const liked = await this.likesRepository.findPostsLikedByUser(
      this.prisma,
      viewerId,
      beforeMs,
      limit,
    );
    const postIds = liked.map((row) => row.post.id);
    const authorIds = liked.map((row) => row.post.authorId);

    const [likeCounts, savedPostIds, followedAuthorIds, blockedAuthorIds] = await Promise.all([
      this.likesRepository.getCounts(postIds),
      this.savedPostsRepository.findSavedPostIds(this.prisma, viewerId, postIds),
      this.postsRepository.findFollowedAuthorIds(this.prisma, viewerId, authorIds),
      this.postsRepository.findBlockedAuthorIds(this.prisma, viewerId, authorIds),
    ]);

    const items = liked
      .filter(({ post }) => !blockedAuthorIds.has(post.authorId))
      .map(({ post }) =>
        PostResponse.from(post, {
          likeCount: likeCounts.get(post.id) ?? 0,
          isLiked: true,
          isFollowing: followedAuthorIds.has(post.authorId),
          isSaved: savedPostIds.has(post.id),
        }),
      );

    const hasMore = liked.length === limit;
    const nextCursor = hasMore
      ? encodeUserPostsCursor(liked[liked.length - 1].likedAt.getTime())
      : null;

    return { items, nextCursor };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfileResponse> {
    if (dto.username) {
      const existing = await this.usersRepository.findByUsername(dto.username);
      if (existing && existing.id !== userId) {
        throw new ConflictException('Username is already taken');
      }
    }

    if (dto.avatarKey && !dto.avatarKey.startsWith(`avatars/${userId}/`)) {
      throw new ForbiddenException('Avatar key does not belong to this user');
    }

    const updated = await this.usersRepository.update(userId, {
      ...(dto.username ? { username: dto.username } : {}),
      ...(dto.avatarKey ? { avatarUrl: this.s3Service.getPublicUrl(dto.avatarKey) } : {}),
      ...(dto.isPrivate !== undefined ? { isPrivate: dto.isPrivate } : {}),
    });

    if (dto.username) {
      try {
        await this.neo4j.run('MATCH (u:User {id: $id}) SET u.username = $username', {
          id: userId,
          username: dto.username,
        });
      } catch (error) {
        this.logger.error({ err: error, userId }, 'Failed to sync username to Neo4j');
      }
    }

    const [followerCount, followingCount] = await Promise.all([
      this.usersRepository.countFollowers(userId),
      this.usersRepository.countFollowing(userId),
    ]);

    return UserProfileResponse.from(updated, {
      followerCount,
      followingCount,
      isFollowing: false,
      hasPendingRequest: false,
      canViewPosts: true,
    });
  }

  async presignAvatarUpload(
    userId: string,
    dto: PresignUploadDto,
  ): Promise<PresignedUploadResponse> {
    const extension = EXTENSION_BY_CONTENT_TYPE[dto.contentType];
    const s3Key = `avatars/${userId}/${randomUUID()}.${extension}`;

    const uploadUrl = await this.s3Service.createPresignedUploadUrl(
      s3Key,
      dto.contentType,
      dto.fileSize,
      PRESIGN_EXPIRY_SECONDS,
    );

    return {
      uploadUrl,
      s3Key,
      publicUrl: this.s3Service.getPublicUrl(s3Key),
      expiresAt: new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000),
    };
  }
}
