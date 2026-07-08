import { ValidationException } from '@/common/exceptions/app.exception';

export function encodeFeedCursor(scoreMs: number): string {
  return Buffer.from(String(scoreMs), 'utf8').toString('base64url');
}

export function decodeFeedCursor(cursor: string | undefined): number | undefined {
  if (cursor === undefined) {
    return undefined;
  }

  const decoded = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isFinite(decoded)) {
    throw new ValidationException('Invalid feed cursor');
  }
  return decoded;
}
