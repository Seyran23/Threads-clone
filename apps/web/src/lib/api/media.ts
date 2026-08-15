import type { PresignedUpload } from '@threads-clone/shared-types';

import { apiFetch } from './client';
import type { PresignUploadInput } from './media.types';

export function presignUpload(data: PresignUploadInput): Promise<PresignedUpload> {
  return apiFetch<PresignedUpload>('/media/presign-upload', { method: 'POST', body: data });
}

export async function uploadToS3(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}
