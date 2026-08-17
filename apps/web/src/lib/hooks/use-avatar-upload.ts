'use client';

import { useCallback, useState } from 'react';

import { uploadToS3 } from '@/lib/api/media';
import { presignAvatarUpload } from '@/lib/api/users';
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/constants/media.constants';

interface AvatarUploadState {
  previewUrl: string;
  status: 'uploading' | 'done' | 'error';
  s3Key?: string;
}

export function useAvatarUpload() {
  const [upload, setUpload] = useState<AvatarUploadState | null>(null);

  const selectFile = useCallback((file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE_BYTES) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setUpload({ previewUrl, status: 'uploading' });

    void (async () => {
      try {
        const presigned = await presignAvatarUpload({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        });
        await uploadToS3(presigned.uploadUrl, file);
        setUpload((prev) => (prev ? { ...prev, status: 'done', s3Key: presigned.s3Key } : prev));
      } catch {
        setUpload((prev) => (prev ? { ...prev, status: 'error' } : prev));
      }
    })();
  }, []);

  const reset = useCallback(() => {
    setUpload((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
  }, []);

  return { upload, selectFile, reset };
}
