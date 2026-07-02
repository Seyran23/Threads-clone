import { User } from '@/generated/prisma';
import { UserResponse } from '@/modules/users/response/user.response';

export class AuthResponse {
  user!: UserResponse;

  static from(user: User): AuthResponse {
    return { user: UserResponse.from(user) };
  }
}
