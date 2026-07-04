export class PresignedUploadResponse {
  uploadUrl!: string;
  s3Key!: string;
  publicUrl!: string;
  expiresAt!: Date;
}
