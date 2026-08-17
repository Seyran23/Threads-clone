import { ValidationException } from '@/common/exceptions/app.exception';

export function encodeUserPostsCursor(beforeMs: number): string {
  return Buffer.from(String(beforeMs), 'utf8').toString('base64url');
}

export function decodeUserPostsCursor(cursor: string | undefined): number | undefined {
  if (cursor === undefined) {
    return undefined;
  }

  const decoded = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isFinite(decoded)) {
    throw new ValidationException('Invalid cursor');
  }
  return decoded;
}
