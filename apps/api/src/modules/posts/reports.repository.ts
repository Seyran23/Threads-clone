import { Injectable } from '@nestjs/common';

import { Report, ReportReason } from '@/generated/prisma';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

@Injectable()
export class ReportsRepository {
  create(
    tx: PrismaClientOrTx,
    reporterId: string,
    postId: string,
    reason: ReportReason,
  ): Promise<Report> {
    return tx.report.create({ data: { reporterId, postId, reason } });
  }

  findOne(tx: PrismaClientOrTx, reporterId: string, postId: string): Promise<Report | null> {
    return tx.report.findUnique({ where: { reporterId_postId: { reporterId, postId } } });
  }
}
