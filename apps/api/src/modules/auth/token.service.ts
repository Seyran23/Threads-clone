import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import jwtConfig from '@/common/config/jwt.config';

import { TokenPayload } from './interfaces/token-payload.interface';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  signAccessToken(userId: string): string {
    return this.jwtService.sign({ sub: userId, jti: randomUUID() } satisfies TokenPayload, {
      privateKey: this.config.accessPrivateKey,
      algorithm: 'RS256',
      expiresIn: this.config.accessTtl,
    });
  }

  signRefreshToken(userId: string): string {
    return this.jwtService.sign({ sub: userId, jti: randomUUID() } satisfies TokenPayload, {
      privateKey: this.config.refreshPrivateKey,
      algorithm: 'RS256',
      expiresIn: this.config.refreshTtl,
    });
  }

  verifyAccessToken(token: string): TokenPayload {
    return this.jwtService.verify<TokenPayload>(token, {
      publicKey: this.config.accessPublicKey,
      algorithms: ['RS256'],
    });
  }

  verifyRefreshToken(token: string): TokenPayload {
    return this.jwtService.verify<TokenPayload>(token, {
      publicKey: this.config.refreshPublicKey,
      algorithms: ['RS256'],
    });
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
