import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponse } from './response/auth.response';
import { SuccessResponse } from './response/success.response';
import { clearAuthCookies, getRefreshTokenCookie, setAuthCookies } from './utils/auth-cookie.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const { tokens, user } = await this.authService.register(dto);
    setAuthCookies(response, tokens);
    return AuthResponse.from(user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const { tokens, user } = await this.authService.login(dto);
    setAuthCookies(response, tokens);
    return AuthResponse.from(user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SuccessResponse> {
    const refreshToken = getRefreshTokenCookie(request);
    const tokens = await this.authService.refresh(refreshToken);
    setAuthCookies(response, tokens);
    return new SuccessResponse();
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SuccessResponse> {
    const refreshToken = getRefreshTokenCookie(request);
    await this.authService.logout(refreshToken);
    clearAuthCookies(response);
    return new SuccessResponse();
  }
}
