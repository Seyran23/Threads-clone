import { Injectable } from '@nestjs/common';

import { Media, MediaProcessingStatus } from '@/generated/prisma';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

import { CreateMediaRecordDto } from './dto/create-media-record.dto';
import { MarkMediaReadyDto } from './dto/mark-media-ready.dto';

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

  findById(tx: PrismaClientOrTx, id: string): Promise<Media | null> {
    return tx.media.findUnique({ where: { id } });
  }

  updateStatus(tx: PrismaClientOrTx, id: string, status: MediaProcessingStatus): Promise<Media> {
    return tx.media.update({ where: { id }, data: { processingStatus: status } });
  }

  markReady(tx: PrismaClientOrTx, id: string, data: MarkMediaReadyDto): Promise<Media> {
    return tx.media.update({
      where: { id },
      data: {
        thumbnailUrl: data.thumbnailUrl,
        width: data.width,
        height: data.height,
        processingStatus: 'READY',
      },
    });
  }
}
