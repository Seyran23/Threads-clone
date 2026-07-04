import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import s3Config from '@/common/config/s3.config';

@Injectable()
export class S3Service {
  private readonly client: S3Client;

  constructor(@Inject(s3Config.KEY) private readonly config: ConfigType<typeof s3Config>) {
    this.client = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.accessKey,
        secretAccessKey: this.config.accessSecret,
      },
    });
  }

  createPresignedUploadUrl(
    key: string,
    contentType: string,
    contentLength: number,
    expiresInSeconds: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  getPublicUrl(key: string): string {
    return `${this.config.publicUrl}/${this.config.bucket}/${key}`;
  }
}
