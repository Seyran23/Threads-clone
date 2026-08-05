import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { NotFoundException } from '@/common/exceptions/app.exception';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AppThrottlerGuard } from '@/common/throttler/app-throttler.guard';
import {
  AUTH_CREDENTIAL_THROTTLE,
  AUTH_REFRESH_THROTTLE,
} from '@/common/throttler/throttler.constants';
import { UsersService } from '@/modules/users/users.service';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponse } from './response/auth.response';
import { SuccessResponse } from './response/success.response';
import { clearAuthCookies, getRefreshTokenCookie, setAuthCookies } from './utils/auth-cookie.util';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { id: string }): Promise<AuthResponse> {
    const fullUser = await this.usersService.findById(user.id);

    if (!fullUser) {
      throw new NotFoundException('User', user.id);
    }

    return AuthResponse.from(fullUser);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AppThrottlerGuard)
  @Throttle(AUTH_CREDENTIAL_THROTTLE)
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
  @UseGuards(AppThrottlerGuard)
  @Throttle(AUTH_CREDENTIAL_THROTTLE)
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
  @UseGuards(AppThrottlerGuard)
  @Throttle(AUTH_REFRESH_THROTTLE)
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
