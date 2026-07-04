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
  let jwtService: JwtService;
  let tokenService: TokenService;
  let access: { privateKey: string; publicKey: string };
  let refresh: { privateKey: string; publicKey: string };

  beforeEach(() => {
    jwtService = new JwtService();
    access = generateRsaKeyPair();
    refresh = generateRsaKeyPair();

    tokenService = new TokenService(jwtService, {
      accessPrivateKey: access.privateKey,
      accessPublicKey: access.publicKey,
      accessTtl: '15m',
      refreshPrivateKey: refresh.privateKey,
      refreshPublicKey: refresh.publicKey,
      refreshTtl: '30d',
    });
  });

  it('signs and verifies a refresh token round-trip', () => {
    const token = tokenService.signRefreshToken('user-1');

    const payload = tokenService.verifyRefreshToken(token);

    expect(payload.sub).toBe('user-1');
  });

  it('rejects a token signed with the access keypair', () => {
    const foreignToken = jwtService.sign(
      { sub: 'user-1' },
      { privateKey: access.privateKey, algorithm: 'RS256' },
    );

    expect(() => tokenService.verifyRefreshToken(foreignToken)).toThrow();
  });

  it('produces distinct tokens for the same user signed back to back', () => {
    const a = tokenService.signRefreshToken('user-1');
    const b = tokenService.signRefreshToken('user-1');

    expect(a).not.toBe(b);
    expect(tokenService.hashToken(a)).not.toBe(tokenService.hashToken(b));
  });

  it('hashes the same token to the same value every time', () => {
    const token = tokenService.signRefreshToken('user-1');

    expect(tokenService.hashToken(token)).toBe(tokenService.hashToken(token));
  });

  it('sets exp exactly refreshTtl seconds after iat', () => {
    const token = tokenService.signRefreshToken('user-1');

    const { iat, exp } = tokenService.verifyRefreshToken(token);

    expect(exp! - iat!).toBe(30 * 24 * 60 * 60);
  });
});
