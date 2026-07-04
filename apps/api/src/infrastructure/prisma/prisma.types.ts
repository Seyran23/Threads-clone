import { Prisma } from '@/generated/prisma';

import { PrismaService } from './prisma.service';

export type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;
