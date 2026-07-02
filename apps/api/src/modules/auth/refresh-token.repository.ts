import { Injectable } from '@nestjs/common';

import { RefreshToken } from '@/generated/prisma';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { CreateRefreshTokenDto } from './dto/create-refresh-token.dto';

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateRefreshTokenDto): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  markUsed(id: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({ where: { id }, data: { used: true } });
  }

  revokeFamily(familyId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { familyId },
      data: { revoked: true },
    });
  }
}
