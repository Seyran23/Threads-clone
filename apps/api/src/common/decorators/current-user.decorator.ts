import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedRequest } from '@/common/interfaces/authenticated-request.interface';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): { id: string } => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
