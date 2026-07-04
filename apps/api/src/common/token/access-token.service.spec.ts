import { generateKeyPairSync } from 'node:crypto';

import { JwtService } from '@nestjs/jwt';

import { AccessTokenService } from './access-token.service';

function generateRsaKeyPair(): { privateKey: string; publicKey: string } {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

describe('AccessTokenService', () => {
  let jwtService: JwtService;
  let accessTokenService: AccessTokenService;
  let keys: { privateKey: string; publicKey: string };

  beforeEach(() => {
    jwtService = new JwtService();
    keys = generateRsaKeyPair();

    accessTokenService = new AccessTokenService(jwtService, {
      accessPrivateKey: keys.privateKey,
      accessPublicKey: keys.publicKey,
      accessTtl: '15m',
      refreshPrivateKey: '',
      refreshPublicKey: '',
      refreshTtl: '30d',
    });
  });

  it('signs and verifies an access token round-trip', () => {
    const token = accessTokenService.sign('user-1');

    const payload = accessTokenService.verify(token);

    expect(payload.sub).toBe('user-1');
  });

  it('rejects a token signed with a different keypair', () => {
    const foreignKeys = generateRsaKeyPair();
    const foreignToken = jwtService.sign(
      { sub: 'user-1' },
      { privateKey: foreignKeys.privateKey, algorithm: 'RS256' },
    );

    expect(() => accessTokenService.verify(foreignToken)).toThrow();
  });

  it('produces distinct tokens for the same user signed back to back', () => {
    const a = accessTokenService.sign('user-1');
    const b = accessTokenService.sign('user-1');

    expect(a).not.toBe(b);
  });

  it('sets exp exactly accessTtl seconds after iat', () => {
    const token = accessTokenService.sign('user-1');

    const { iat, exp } = accessTokenService.verify(token);

    expect(exp! - iat!).toBe(15 * 60);
  });
});
