import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { TrendingController } from './trending.controller';
import { TrendingRepository } from './trending.repository';
import { TrendingService } from './trending.service';

@Module({
  controllers: [TrendingController],
  providers: [TrendingRepository, TrendingService, JwtAuthGuard],
  exports: [TrendingService],
})
export class TrendingModule {}
