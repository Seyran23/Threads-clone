import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { ForbiddenException } from '@/common/exceptions/app.exception';
import { S3Service } from '@/infrastructure/s3/s3.service';

import { EXTENSION_BY_CONTENT_TYPE, PRESIGN_EXPIRY_SECONDS } from './constants/media.constants';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { PresignedUploadResponse } from './response/presigned-upload.response';

@Injectable()
export class MediaService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MediaService.name);
  }

  getPublicUrl(s3Key: string): string {
    return this.s3Service.getPublicUrl(s3Key);
  }

  assertOwnedByUser(userId: string, s3Keys: string[]): void {
    const unauthorized = s3Keys.some((key) => !key.startsWith(`media/${userId}/`));
    if (unauthorized) {
      this.logger.warn({ userId, s3Keys }, 'Rejected mediaKeys not owned by user');
      throw new ForbiddenException('One or more media keys do not belong to this user');
    }
  }

  async createPresignedUpload(
    userId: string,
    dto: PresignUploadDto,
  ): Promise<PresignedUploadResponse> {
    const extension = EXTENSION_BY_CONTENT_TYPE[dto.contentType];
    const s3Key = `media/${userId}/${randomUUID()}.${extension}`;

    const uploadUrl = await this.s3Service.createPresignedUploadUrl(
      s3Key,
      dto.contentType,
      dto.fileSize,
      PRESIGN_EXPIRY_SECONDS,
    );
    this.logger.info(
      { userId, s3Key, contentType: dto.contentType, fileSize: dto.fileSize },
      'Presigned upload URL issued',
    );

    return {
      uploadUrl,
      s3Key,
      publicUrl: this.s3Service.getPublicUrl(s3Key),
      expiresAt: new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000),
    };
  }
}
