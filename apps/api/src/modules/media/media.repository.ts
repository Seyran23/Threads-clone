import { Injectable } from '@nestjs/common';

import { Media } from '@/generated/prisma';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

import { CreateMediaRecordDto } from './dto/create-media-record.dto';

@Injectable()
export class MediaRepository {
  create(tx: PrismaClientOrTx, data: CreateMediaRecordDto): Promise<Media> {
    return tx.media.create({
      data: {
        postId: data.postId,
        s3Key: data.s3Key,
        url: data.url,
        order: data.order,
      },
    });
  }
}
