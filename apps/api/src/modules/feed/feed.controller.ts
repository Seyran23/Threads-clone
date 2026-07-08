import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { GetFeedQueryDto } from './dto/get-feed-query.dto';
import { FeedService } from './feed.service';
import { FeedResponse } from './response/feed.response';

@ApiTags('feed')
@ApiCookieAuth()
@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  getFeed(
    @CurrentUser() user: { id: string },
    @Query() query: GetFeedQueryDto,
  ): Promise<FeedResponse> {
    return this.feedService.getFeed(user.id, query.cursor, query.limit);
  }
}
