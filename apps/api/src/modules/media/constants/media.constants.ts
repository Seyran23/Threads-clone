export const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const PRESIGN_EXPIRY_SECONDS = 10 * 60;

export const EXTENSION_BY_CONTENT_TYPE: Record<(typeof ALLOWED_CONTENT_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const IMAGE_PROCESSING_QUEUE_NAME = 'image-processing';

export const THUMBNAIL_MAX_DIMENSION = 600;

export const MAX_INPUT_PIXELS = 50_000_000;

export const IMAGE_PROCESSING_JOB_ATTEMPTS = 3;
export const IMAGE_PROCESSING_BACKOFF_DELAY_MS = 2000;
