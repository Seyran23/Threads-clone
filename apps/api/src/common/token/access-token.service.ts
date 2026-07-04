import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import jwtConfig from '@/common/config/jwt.config';

import { TokenPayload } from './token-payload.interface';

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  sign(userId: string): string {
    return this.jwtService.sign({ sub: userId, jti: randomUUID() } satisfies TokenPayload, {
      privateKey: this.config.accessPrivateKey,
      algorithm: 'RS256',
      expiresIn: this.config.accessTtl,
    });
  }

  verify(token: string): TokenPayload {
    return this.jwtService.verify<TokenPayload>(token, {
      publicKey: this.config.accessPublicKey,
      algorithms: ['RS256'],
    });
  }
}
