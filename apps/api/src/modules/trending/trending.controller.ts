import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { GetTrendingQueryDto } from './dto/get-trending-query.dto';
import { TrendingHashtagResponse } from './response/trending-hashtag.response';
import { TrendingService } from './trending.service';

@ApiTags('trending')
@ApiCookieAuth()
@Controller('trending')
@UseGuards(JwtAuthGuard)
export class TrendingController {
  constructor(private readonly trendingService: TrendingService) {}

  @Get()
  getTrending(@Query() query: GetTrendingQueryDto): Promise<TrendingHashtagResponse[]> {
    return this.trendingService.getTopHashtags(query.limit);
  }
}
