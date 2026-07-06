import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import sharp from 'sharp';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';
import { S3Service } from '@/infrastructure/s3/s3.service';

import {
  IMAGE_PROCESSING_QUEUE_NAME,
  MAX_INPUT_PIXELS,
  THUMBNAIL_MAX_DIMENSION,
} from '../constants/media.constants';
import { MediaRepository } from '../media.repository';

import { ThumbnailJobData } from './thumbnail-job-data.interface';

@Injectable()
export class ImageProcessingProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker<ThumbnailJobData>;

  constructor(
    private readonly connection: BullMqConnectionService,
    private readonly s3Service: S3Service,
    private readonly mediaRepository: MediaRepository,
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ImageProcessingProcessor.name);
  }

  onModuleInit(): void {
    this.worker = new Worker<ThumbnailJobData>(
      IMAGE_PROCESSING_QUEUE_NAME,
      (job) => this.processJob(job),
      { connection: this.connection },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, mediaId: job?.data.mediaId, err },
        'Thumbnail job failed',
      );
    });
  }

  async processJob(job: Job<ThumbnailJobData>): Promise<void> {
    const { mediaId } = job.data;
    this.logger.info({ jobId: job.id, mediaId }, 'Thumbnail job picked up');

    const media = await this.mediaRepository.findById(this.prisma, mediaId);
    if (!media) {
      this.logger.warn({ jobId: job.id, mediaId }, 'Media row no longer exists, skipping');
      return;
    }

    await this.mediaRepository.updateStatus(this.prisma, media.id, 'PROCESSING');
    this.logger.info({ mediaId, s3Key: media.s3Key }, 'Marked PROCESSING, downloading original');

    try {
      const original = await this.s3Service.getObject(media.s3Key);
      this.logger.info({ mediaId, bytes: original.length }, 'Downloaded original from S3');

      const image = sharp(original, { limitInputPixels: MAX_INPUT_PIXELS });
      const metadata = await image.metadata();
      this.logger.info(
        { mediaId, width: metadata.width, height: metadata.height, format: metadata.format },
        'Decoded image metadata',
      );

      const thumbnail = await image
        .resize({
          width: THUMBNAIL_MAX_DIMENSION,
          height: THUMBNAIL_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();
      this.logger.info({ mediaId, bytes: thumbnail.length }, 'Generated resized JPEG thumbnail');

      const thumbnailKey = media.s3Key.replace(/\.[^./]+$/, '-thumb.jpg');
      await this.s3Service.putObject(thumbnailKey, thumbnail, 'image/jpeg');
      this.logger.info({ mediaId, thumbnailKey }, 'Uploaded thumbnail to S3');

      await this.mediaRepository.markReady(this.prisma, media.id, {
        thumbnailUrl: this.s3Service.getPublicUrl(thumbnailKey),
        width: metadata.width ?? null,
        height: metadata.height ?? null,
      });
      this.logger.info({ mediaId }, 'Marked READY');
    } catch (err) {
      await this.mediaRepository.updateStatus(this.prisma, media.id, 'FAILED');
      this.logger.error(
        { mediaId, jobId: job.id, attempt: job.attemptsMade + 1, err },
        'Thumbnail generation failed',
      );
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
