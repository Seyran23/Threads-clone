import { ValidationException } from '@/common/exceptions/app.exception';

import { decodeFeedCursor, encodeFeedCursor } from './feed-cursor.util';

describe('feed cursor encode/decode', () => {
  it('round-trips a score through encode then decode', () => {
    const cursor = encodeFeedCursor(1720440000000);

    expect(decodeFeedCursor(cursor)).toBe(1720440000000);
  });

  it('returns undefined when no cursor is given', () => {
    expect(decodeFeedCursor(undefined)).toBeUndefined();
  });

  it('throws ValidationException for a malformed cursor', () => {
    expect(() => decodeFeedCursor('not-a-valid-cursor!!')).toThrow(ValidationException);
  });
});
