import type { Request, Response } from 'express';

import { UnauthorizedException } from '@/common/exceptions/app.exception';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/common/token/token-cookie.constants';

import { IssuedTokens } from '../interfaces/issued-tokens.interface';

const isProd = process.env.NODE_ENV === 'production';

export function setAuthCookies(response: Response, tokens: IssuedTokens): void {
  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    expires: tokens.accessTokenExpiresAt,
  });
  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    expires: tokens.refreshTokenExpiresAt,
  });
}

export function clearAuthCookies(response: Response): void {
  response.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  response.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
}

export function getRefreshTokenCookie(request: Request): string {
  const token: unknown = request.cookies?.[REFRESH_TOKEN_COOKIE];
  if (typeof token !== 'string' || token.length === 0) {
    throw new UnauthorizedException('Missing refresh token');
  }
  return token;
}
