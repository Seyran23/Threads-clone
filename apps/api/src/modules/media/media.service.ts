import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { S3Service } from '@/infrastructure/s3/s3.service';

import { EXTENSION_BY_CONTENT_TYPE, PRESIGN_EXPIRY_SECONDS } from './constants/media.constants';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { PresignedUploadResponse } from './response/presigned-upload.response';

@Injectable()
export class MediaService {
  constructor(private readonly s3Service: S3Service) {}

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

    return {
      uploadUrl,
      s3Key,
      publicUrl: this.s3Service.getPublicUrl(s3Key),
      expiresAt: new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000),
    };
  }
}
