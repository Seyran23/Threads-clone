import { registerAs } from '@nestjs/config';

export interface S3Config {
  endpoint: string;
  publicUrl: string;
  region: string;
  accessKey: string;
  accessSecret: string;
  bucket: string;
}

export default registerAs('s3', (): S3Config => ({
  endpoint: process.env.S3_ENDPOINT!,
  publicUrl: process.env.S3_PUBLIC_URL!,
  region: process.env.S3_REGION!,
  accessKey: process.env.S3_ACCESS_KEY!,
  accessSecret: process.env.S3_ACCESS_SECRET!,
  bucket: process.env.S3_BUCKET!,
}));
