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
});
