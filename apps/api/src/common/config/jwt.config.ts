import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  accessPrivateKey: string;
  accessPublicKey: string;
  accessTtl: string;
  refreshPrivateKey: string;
  refreshPublicKey: string;
  refreshTtl: string;
}

function unescapeNewlines(pem: string): string {
  return pem.replace(/\\n/g, '\n');
}

export default registerAs('jwt', (): JwtConfig => ({
  accessPrivateKey: unescapeNewlines(process.env.JWT_ACCESS_PRIVATE_KEY!),
  accessPublicKey: unescapeNewlines(process.env.JWT_ACCESS_PUBLIC_KEY!),
  accessTtl: process.env.JWT_ACCESS_TOKEN_TTL!,
  refreshPrivateKey: unescapeNewlines(process.env.JWT_REFRESH_PRIVATE_KEY!),
  refreshPublicKey: unescapeNewlines(process.env.JWT_REFRESH_PUBLIC_KEY!),
  refreshTtl: process.env.JWT_REFRESH_TOKEN_TTL!,
}));
