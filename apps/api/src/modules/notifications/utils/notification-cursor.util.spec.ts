import { ValidationException } from '@/common/exceptions/app.exception';

import { decodeNotificationCursor, encodeNotificationCursor } from './notification-cursor.util';

describe('notification cursor encode/decode', () => {
  it('round-trips a score through encode then decode', () => {
    const cursor = encodeNotificationCursor(1720440000000);

    expect(decodeNotificationCursor(cursor)).toBe(1720440000000);
  });

  it('returns undefined when no cursor is given', () => {
    expect(decodeNotificationCursor(undefined)).toBeUndefined();
  });

  it('throws ValidationException for a malformed cursor', () => {
    expect(() => decodeNotificationCursor('not-a-valid-cursor!!')).toThrow(ValidationException);
  });
});
