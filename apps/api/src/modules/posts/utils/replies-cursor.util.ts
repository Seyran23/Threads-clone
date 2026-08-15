import { ValidationException } from '@/common/exceptions/app.exception';

export function encodeRepliesCursor(afterMs: number): string {
  return Buffer.from(String(afterMs), 'utf8').toString('base64url');
}

export function decodeRepliesCursor(cursor: string | undefined): number | undefined {
  if (cursor === undefined) {
    return undefined;
  }

  const decoded = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isFinite(decoded)) {
    throw new ValidationException('Invalid replies cursor');
  }
  return decoded;
}
