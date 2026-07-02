import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

import { UnauthorizedException } from '@/common/exceptions/app.exception';
import { UsersService } from '@/modules/users/users.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResult } from './interfaces/auth-result.interface';
import { IssuedTokens } from './interfaces/issued-tokens.interface';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.createUser({
      email: dto.email,
      username: dto.username,
      passwordHash,
    });

    const tokens = await this.issueTokens(user.id, randomUUID());
    return { tokens, user };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, randomUUID());
    return { tokens, user };
  }

  async refresh(refreshToken: string): Promise<IssuedTokens> {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const stored = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.used || stored.revoked) {
      await this.refreshTokenRepository.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Refresh token reuse detected; session revoked');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    try {
      this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.refreshTokenRepository.markUsed(stored.id);

    return this.issueTokens(stored.userId, stored.familyId);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const stored = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (!stored) {
      return;
    }

    await this.refreshTokenRepository.revokeFamily(stored.familyId);
  }

  private async issueTokens(userId: string, familyId: string): Promise<IssuedTokens> {
    const accessToken = this.tokenService.signAccessToken(userId);
    const refreshToken = this.tokenService.signRefreshToken(userId);
    const { exp: accessExp } = this.tokenService.verifyAccessToken(accessToken);
    const { exp: refreshExp } = this.tokenService.verifyRefreshToken(refreshToken);

    await this.refreshTokenRepository.create({
      userId,
      familyId,
      tokenHash: this.tokenService.hashToken(refreshToken),
      expiresAt: new Date(refreshExp! * 1000),
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(accessExp! * 1000),
      refreshTokenExpiresAt: new Date(refreshExp! * 1000),
    };
  }
}
