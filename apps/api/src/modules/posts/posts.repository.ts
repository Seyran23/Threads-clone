import { Injectable } from '@nestjs/common';

import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

import { CreatePostRecordDto } from './dto/create-post-record.dto';
import { PostWithRelations } from './response/post.response';

export const POST_INCLUDE = {
  author: true,
  hashtags: { include: { hashtag: true } },
  media: { orderBy: { order: 'asc' } },
} as const;

@Injectable()
export class PostsRepository {
  findById(tx: PrismaClientOrTx, id: string): Promise<PostWithRelations | null> {
    return tx.post.findUnique({ where: { id }, include: POST_INCLUDE });
  }

  findDepthById(tx: PrismaClientOrTx, id: string): Promise<{ depth: number } | null> {
    return tx.post.findUnique({ where: { id }, select: { depth: true } });
  }

  create(tx: PrismaClientOrTx, data: CreatePostRecordDto): Promise<PostWithRelations> {
    return tx.post.create({
      data: {
        authorId: data.authorId,
        content: data.content,
        parentId: data.parentId,
        depth: data.depth,
        hashtags: { create: data.hashtagIds.map((hashtagId) => ({ hashtagId })) },
      },
      include: POST_INCLUDE,
    });
  }
}
