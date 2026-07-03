import { generateKeyPairSync } from 'node:crypto';

import { JwtService } from '@nestjs/jwt';

import { TokenService } from './token.service';

function generateRsaKeyPair(): { privateKey: string; publicKey: string } {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

describe('TokenService', () => {
  let tokenService: TokenService;

  beforeEach(() => {
    const access = generateRsaKeyPair();
    const refresh = generateRsaKeyPair();

    tokenService = new TokenService(new JwtService(), {
      accessPrivateKey: access.privateKey,
      accessPublicKey: access.publicKey,
      accessTtl: '15m',
      refreshPrivateKey: refresh.privateKey,
      refreshPublicKey: refresh.publicKey,
      refreshTtl: '30d',
    });
  });

  it('signs and verifies an access token round-trip', () => {
    const token = tokenService.signAccessToken('user-1');

    const payload = tokenService.verifyAccessToken(token);

    expect(payload.sub).toBe('user-1');
  });

  it('signs and verifies a refresh token round-trip', () => {
    const token = tokenService.signRefreshToken('user-1');

    const payload = tokenService.verifyRefreshToken(token);

    expect(payload.sub).toBe('user-1');
  });

  it('rejects an access token verified against the refresh keypair', () => {
    const token = tokenService.signAccessToken('user-1');

    expect(() => tokenService.verifyRefreshToken(token)).toThrow();
  });

  it('rejects a refresh token verified against the access keypair', () => {
    const token = tokenService.signRefreshToken('user-1');

    expect(() => tokenService.verifyAccessToken(token)).toThrow();
  });

  it('produces distinct tokens for the same user signed back to back', () => {
    const a = tokenService.signRefreshToken('user-1');
    const b = tokenService.signRefreshToken('user-1');

    expect(a).not.toBe(b);
    expect(tokenService.hashToken(a)).not.toBe(tokenService.hashToken(b));
  });

  it('hashes the same token to the same value every time', () => {
    const token = tokenService.signAccessToken('user-1');

    expect(tokenService.hashToken(token)).toBe(tokenService.hashToken(token));
  });

  it('sets exp exactly accessTtl seconds after iat', () => {
    const token = tokenService.signAccessToken('user-1');

    const { iat, exp } = tokenService.verifyAccessToken(token);

    expect(exp! - iat!).toBe(15 * 60);
  });

  it('sets exp exactly refreshTtl seconds after iat', () => {
    const token = tokenService.signRefreshToken('user-1');

    const { iat, exp } = tokenService.verifyRefreshToken(token);

    expect(exp! - iat!).toBe(30 * 24 * 60 * 60);
  });
});
