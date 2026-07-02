import { User } from '@/generated/prisma';

import { IssuedTokens } from './issued-tokens.interface';

export interface AuthResult {
  tokens: IssuedTokens;
  user: User;
}
