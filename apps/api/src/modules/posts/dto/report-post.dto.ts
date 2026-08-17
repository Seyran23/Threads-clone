import { IsEnum } from 'class-validator';

import { ReportReason } from '@/generated/prisma';

export class ReportPostDto {
  @IsEnum(ReportReason)
  reason!: ReportReason;
}
