import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { UnauthorizedException } from '@/common/exceptions/app.exception';
import { AuthenticatedRequest } from '@/common/interfaces/authenticated-request.interface';
import { AccessTokenService } from '@/common/token/access-token.service';
import { ACCESS_TOKEN_COOKIE } from '@/common/token/token-cookie.constants';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly accessTokenService: AccessTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = request.cookies?.[ACCESS_TOKEN_COOKIE];

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const payload = this.accessTokenService.verify(token);
      request.user = { id: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
