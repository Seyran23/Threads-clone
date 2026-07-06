import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PinoLogger } from 'nestjs-pino';

import { UnauthorizedException } from '@/common/exceptions/app.exception';
import { AccessTokenService } from '@/common/token/access-token.service';
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
    private readonly accessTokenService: AccessTokenService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.createUser({
      email: dto.email,
      username: dto.username,
      passwordHash,
    });

    const tokens = await this.issueTokens(user.id, randomUUID());
    this.logger.info({ userId: user.id }, 'User registered');
    return { tokens, user };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      this.logger.warn({ email: dto.email }, 'Login failed: invalid credentials');
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, randomUUID());
    this.logger.info({ userId: user.id }, 'User logged in');
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
      this.logger.warn(
        { userId: stored.userId, familyId: stored.familyId },
        'Refresh token reuse detected; session revoked',
      );
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
    this.logger.info({ userId: stored.userId, familyId: stored.familyId }, 'Token refreshed');

    return this.issueTokens(stored.userId, stored.familyId);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const stored = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (!stored) {
      return;
    }

    await this.refreshTokenRepository.revokeFamily(stored.familyId);
    this.logger.info({ userId: stored.userId, familyId: stored.familyId }, 'User logged out');
  }

  private async issueTokens(userId: string, familyId: string): Promise<IssuedTokens> {
    const accessToken = this.accessTokenService.sign(userId);
    const refreshToken = this.tokenService.signRefreshToken(userId);
    const { exp: accessExp } = this.accessTokenService.verify(accessToken);
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
