import { buildPrefixTsQuery } from './build-prefix-ts-query.util';

describe('buildPrefixTsQuery', () => {
  it('appends the prefix operator to a single word', () => {
    expect(buildPrefixTsQuery('sey')).toBe('sey:*');
  });

  it('treats earlier words as complete and only prefix-matches the last word', () => {
    expect(buildPrefixTsQuery('hello wor')).toBe('hello & wor:*');
  });

  it('strips tsquery special characters out of each word', () => {
    expect(buildPrefixTsQuery('foo&bar (baz)')).toBe('foobar & baz:*');
  });

  it('collapses repeated whitespace between words', () => {
    expect(buildPrefixTsQuery('  hello   world  ')).toBe('hello & world:*');
  });

  it('returns an empty string for input with no usable words', () => {
    expect(buildPrefixTsQuery('   ')).toBe('');
    expect(buildPrefixTsQuery('&|!()')).toBe('');
  });
});
