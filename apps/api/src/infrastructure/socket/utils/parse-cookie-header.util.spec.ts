import { parseCookieHeader } from './parse-cookie-header.util';

describe('parseCookieHeader', () => {
  it('parses a single cookie', () => {
    expect(parseCookieHeader('access_token=abc123')).toEqual({ access_token: 'abc123' });
  });

  it('parses multiple semicolon-separated cookies', () => {
    expect(parseCookieHeader('access_token=abc123; refresh_token=xyz789')).toEqual({
      access_token: 'abc123',
      refresh_token: 'xyz789',
    });
  });

  it('decodes URI-encoded values', () => {
    expect(parseCookieHeader('name=hello%20world')).toEqual({ name: 'hello world' });
  });

  it('ignores malformed segments without an "="', () => {
    expect(parseCookieHeader('access_token=abc123; garbage; refresh_token=xyz789')).toEqual({
      access_token: 'abc123',
      refresh_token: 'xyz789',
    });
  });

  it('returns an empty object for an empty header', () => {
    expect(parseCookieHeader('')).toEqual({});
  });
});
