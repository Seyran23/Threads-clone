import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { SearchController } from './search.controller';
import { SearchRepository } from './search.repository';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers: [SearchRepository, SearchService, JwtAuthGuard],
})
export class SearchModule {}
