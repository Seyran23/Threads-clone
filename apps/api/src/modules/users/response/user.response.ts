import { User } from '@/generated/prisma';

export class UserResponse {
  id!: string;
  email!: string;
  username!: string;
  avatarUrl!: string | null;
  createdAt!: Date;

  static from(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}
