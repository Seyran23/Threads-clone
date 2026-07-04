import { ForbiddenException } from '@/common/exceptions/app.exception';
import { S3Service } from '@/infrastructure/s3/s3.service';

import { PresignUploadDto } from './dto/presign-upload.dto';
import { MediaService } from './media.service';

describe('MediaService', () => {
  let mediaService: MediaService;
  let s3Service: jest.Mocked<S3Service>;

  const dto: PresignUploadDto = {
    filename: 'photo.jpg',
    contentType: 'image/jpeg',
    fileSize: 1024,
  };

  beforeEach(() => {
    s3Service = {
      createPresignedUploadUrl: jest.fn(),
      getPublicUrl: jest.fn(),
    } as unknown as jest.Mocked<S3Service>;

    mediaService = new MediaService(s3Service);

    s3Service.createPresignedUploadUrl.mockResolvedValue('https://signed-upload-url');
    s3Service.getPublicUrl.mockImplementation((key) => `https://public/${key}`);
  });

  it('generates an S3 key namespaced by userId with the right extension', async () => {
    const result = await mediaService.createPresignedUpload('user-1', dto);

    expect(result.s3Key).toMatch(/^media\/user-1\/[0-9a-f-]{36}\.jpg$/);
  });

  it('signs the upload with the declared contentType and fileSize', async () => {
    await mediaService.createPresignedUpload('user-1', dto);

    expect(s3Service.createPresignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^media\/user-1\//),
      'image/jpeg',
      1024,
      600,
    );
  });

  it('returns the presigned upload url and matching public url', async () => {
    const result = await mediaService.createPresignedUpload('user-1', dto);

    expect(result.uploadUrl).toBe('https://signed-upload-url');
    expect(result.publicUrl).toBe(`https://public/${result.s3Key}`);
  });

  it('sets expiresAt roughly 10 minutes in the future', async () => {
    const before = Date.now();

    const result = await mediaService.createPresignedUpload('user-1', dto);

    expect(result.expiresAt.getTime() - before).toBeGreaterThanOrEqual(10 * 60 * 1000 - 100);
    expect(result.expiresAt.getTime() - before).toBeLessThanOrEqual(10 * 60 * 1000 + 1000);
  });

  it('generates distinct keys for back-to-back presign requests', async () => {
    const a = await mediaService.createPresignedUpload('user-1', dto);
    const b = await mediaService.createPresignedUpload('user-1', dto);

    expect(a.s3Key).not.toBe(b.s3Key);
  });

  describe('assertOwnedByUser', () => {
    it('does not throw when every key is namespaced under the given userId', () => {
      expect(() =>
        mediaService.assertOwnedByUser('user-1', ['media/user-1/a.jpg', 'media/user-1/b.png']),
      ).not.toThrow();
    });

    it('does not throw for an empty key list', () => {
      expect(() => mediaService.assertOwnedByUser('user-1', [])).not.toThrow();
    });

    it('throws ForbiddenException when a key belongs to a different user', () => {
      expect(() => mediaService.assertOwnedByUser('user-1', ['media/user-2/a.jpg'])).toThrow(
        ForbiddenException,
      );
    });

    it('throws when only one of several keys belongs to another user', () => {
      expect(() =>
        mediaService.assertOwnedByUser('user-1', ['media/user-1/a.jpg', 'media/user-2/b.jpg']),
      ).toThrow(ForbiddenException);
    });
  });

  describe('getPublicUrl', () => {
    it('delegates to S3Service', () => {
      const result = mediaService.getPublicUrl('media/user-1/a.jpg');

      expect(s3Service.getPublicUrl).toHaveBeenCalledWith('media/user-1/a.jpg');
      expect(result).toBe('https://public/media/user-1/a.jpg');
    });
  });
});
