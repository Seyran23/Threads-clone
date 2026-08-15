'use client';

import { useCallback, useState } from 'react';

import { presignUpload, uploadToS3 } from '@/lib/api/media';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGES_PER_POST,
} from '@/lib/constants/media.constants';

export interface ImageUpload {
  id: string;
  file: File;
  previewUrl: string;
  status: 'uploading' | 'done' | 'error';
  s3Key?: string;
}

export function useImageUploads() {
  const [uploads, setUploads] = useState<ImageUpload[]>([]);

  const startUpload = useCallback(async (upload: ImageUpload) => {
    try {
      const presigned = await presignUpload({
        filename: upload.file.name,
        contentType: upload.file.type,
        fileSize: upload.file.size,
      });
      await uploadToS3(presigned.uploadUrl, upload.file);
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id ? { ...u, status: 'done', s3Key: presigned.s3Key } : u,
        ),
      );
    } catch {
      setUploads((prev) => prev.map((u) => (u.id === upload.id ? { ...u, status: 'error' } : u)));
    }
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setUploads((prev) => {
        const remaining = MAX_IMAGES_PER_POST - prev.length;
        const accepted = Array.from(files)
          .filter(
            (file) => ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE_BYTES,
          )
          .slice(0, Math.max(remaining, 0));

        const newUploads: ImageUpload[] = accepted.map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'uploading',
        }));

        newUploads.forEach((upload) => {
          void startUpload(upload);
        });

        return [...prev, ...newUploads];
      });
    },
    [startUpload],
  );

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => {
      const target = prev.find((u) => u.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((u) => u.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    setUploads((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u.previewUrl));
      return [];
    });
  }, []);

  const isUploading = uploads.some((u) => u.status === 'uploading');
  const hasError = uploads.some((u) => u.status === 'error');
  const s3Keys = uploads.filter((u) => u.status === 'done').map((u) => u.s3Key!);

  return { uploads, addFiles, removeUpload, reset, isUploading, hasError, s3Keys };
}
