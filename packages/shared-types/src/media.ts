export type MediaProcessingStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';

export interface Media {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  blurHash: string | null;
  width: number | null;
  height: number | null;
  processingStatus: MediaProcessingStatus;
}

export interface PresignedUpload {
  uploadUrl: string;
  s3Key: string;
  publicUrl: string;
  expiresAt: string;
}
