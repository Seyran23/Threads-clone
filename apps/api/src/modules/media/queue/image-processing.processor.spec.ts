import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import sharp from 'sharp';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { BullMqConnectionService } from '@/infrastructure/queue/bullmq-connection.service';
import { S3Service } from '@/infrastructure/s3/s3.service';

import { MAX_INPUT_PIXELS, THUMBNAIL_MAX_DIMENSION } from '../constants/media.constants';
import { MediaRepository } from '../media.repository';

import { ImageProcessingProcessor } from './image-processing.processor';
import { ThumbnailJobData } from './thumbnail-job-data.interface';

jest.mock('sharp');
jest.mock('bullmq', () => ({
  ...jest.requireActual('bullmq'),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn() })),
}));

describe('ImageProcessingProcessor', () => {
  let processor: ImageProcessingProcessor;
  let s3Service: jest.Mocked<S3Service>;
  let mediaRepository: jest.Mocked<MediaRepository>;
  let prisma: PrismaService;
  let mockResize: jest.Mock;
  let mockJpeg: jest.Mock;
  let mockToBuffer: jest.Mock;
  let mockMetadata: jest.Mock;

  const media = {
    id: 'media-1',
    postId: 'post-1',
    s3Key: 'media/user-1/abc.jpg',
    url: 'https://public/media/user-1/abc.jpg',
    thumbnailUrl: null,
    width: null,
    height: null,
    order: 0,
    processingStatus: 'QUEUED',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const job = {
    id: 'job-1',
    data: { mediaId: 'media-1' },
    attemptsMade: 0,
  } as Job<ThumbnailJobData>;
  let logger: jest.Mocked<PinoLogger>;

  beforeEach(() => {
    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    s3Service = {
      getObject: jest.fn().mockResolvedValue(Buffer.from('original-bytes')),
      putObject: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest.fn((key: string) => `https://public/${key}`),
    } as unknown as jest.Mocked<S3Service>;

    mediaRepository = {
      findById: jest.fn().mockResolvedValue(media),
      updateStatus: jest.fn(),
      markReady: jest.fn(),
    } as unknown as jest.Mocked<MediaRepository>;

    prisma = {} as PrismaService;

    mockToBuffer = jest.fn().mockResolvedValue(Buffer.from('thumbnail-bytes'));
    mockJpeg = jest.fn();
    mockResize = jest.fn();
    mockMetadata = jest.fn().mockResolvedValue({ width: 1920, height: 1080 });

    const fakeSharpInstance = {
      metadata: mockMetadata,
      resize: mockResize,
      jpeg: mockJpeg,
      toBuffer: mockToBuffer,
    };
    mockResize.mockReturnValue(fakeSharpInstance);
    mockJpeg.mockReturnValue(fakeSharpInstance);
    jest.mocked(sharp).mockReturnValue(fakeSharpInstance as never);

    processor = new ImageProcessingProcessor(
      {} as BullMqConnectionService,
      s3Service,
      mediaRepository,
      prisma,
      logger,
    );
  });

  it('does nothing when the media row no longer exists', async () => {
    mediaRepository.findById.mockResolvedValue(null);

    await processor.processJob(job);

    expect(mediaRepository.updateStatus).not.toHaveBeenCalled();
    expect(s3Service.getObject).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      { jobId: 'job-1', mediaId: 'media-1' },
      'Media row no longer exists, skipping',
    );
  });

  it('marks PROCESSING, downloads the original, and decodes it with an explicit pixel limit', async () => {
    await processor.processJob(job);

    expect(mediaRepository.updateStatus).toHaveBeenCalledWith(prisma, 'media-1', 'PROCESSING');
    expect(s3Service.getObject).toHaveBeenCalledWith('media/user-1/abc.jpg');
    expect(sharp).toHaveBeenCalledWith(Buffer.from('original-bytes'), {
      limitInputPixels: MAX_INPUT_PIXELS,
    });
  });

  it('resizes to the configured max dimension, preserving aspect ratio without enlarging', async () => {
    await processor.processJob(job);

    expect(mockResize).toHaveBeenCalledWith({
      width: THUMBNAIL_MAX_DIMENSION,
      height: THUMBNAIL_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
    expect(mockJpeg).toHaveBeenCalledWith({ quality: 80 });
  });

  it('uploads the thumbnail under a derived key and marks the row READY with real dimensions', async () => {
    await processor.processJob(job);

    expect(s3Service.putObject).toHaveBeenCalledWith(
      'media/user-1/abc-thumb.jpg',
      Buffer.from('thumbnail-bytes'),
      'image/jpeg',
    );
    expect(mediaRepository.markReady).toHaveBeenCalledWith(prisma, 'media-1', {
      thumbnailUrl: 'https://public/media/user-1/abc-thumb.jpg',
      width: 1920,
      height: 1080,
    });
  });

  it('logs every step of a successful run', async () => {
    await processor.processJob(job);

    expect(logger.info).toHaveBeenCalledWith(
      { jobId: 'job-1', mediaId: 'media-1' },
      'Thumbnail job picked up',
    );
    expect(logger.info).toHaveBeenCalledWith(
      { mediaId: 'media-1', bytes: Buffer.from('original-bytes').length },
      'Downloaded original from S3',
    );
    expect(logger.info).toHaveBeenCalledWith(
      { mediaId: 'media-1', width: 1920, height: 1080, format: undefined },
      'Decoded image metadata',
    );
    expect(logger.info).toHaveBeenCalledWith(
      { mediaId: 'media-1', bytes: Buffer.from('thumbnail-bytes').length },
      'Generated resized JPEG thumbnail',
    );
    expect(logger.info).toHaveBeenCalledWith(
      { mediaId: 'media-1', thumbnailKey: 'media/user-1/abc-thumb.jpg' },
      'Uploaded thumbnail to S3',
    );
    expect(logger.info).toHaveBeenCalledWith({ mediaId: 'media-1' }, 'Marked READY');
  });

  it('marks the row FAILED and rethrows when processing fails, so BullMQ retries it', async () => {
    s3Service.getObject.mockRejectedValue(new Error('S3 unreachable'));

    await expect(processor.processJob(job)).rejects.toThrow('S3 unreachable');

    expect(mediaRepository.updateStatus).toHaveBeenCalledWith(prisma, 'media-1', 'FAILED');
    expect(mediaRepository.markReady).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      { mediaId: 'media-1', jobId: 'job-1', attempt: 1, err: expect.any(Error) },
      'Thumbnail generation failed',
    );
  });
});
