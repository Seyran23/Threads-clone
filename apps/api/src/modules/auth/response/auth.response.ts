import { User } from '@/generated/prisma';
import { UserResponse } from '@/modules/users/response/user.response';

import { TokenResponse } from './token.response';

export class AuthResponse {
  accessToken!: string;
  refreshToken!: string;
  user!: UserResponse;

  static from(tokens: TokenResponse, user: User): AuthResponse {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: UserResponse.from(user),
    };
  }
}
