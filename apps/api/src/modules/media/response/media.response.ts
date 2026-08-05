import { Media, MediaProcessingStatus } from '@/generated/prisma';

export class MediaResponse {
  id!: string;
  url!: string;
  thumbnailUrl!: string | null;
  blurHash!: string | null;
  width!: number | null;
  height!: number | null;
  processingStatus!: MediaProcessingStatus;

  static from(media: Media): MediaResponse {
    return {
      id: media.id,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
      blurHash: media.blurHash,
      width: media.width,
      height: media.height,
      processingStatus: media.processingStatus,
    };
  }
}
