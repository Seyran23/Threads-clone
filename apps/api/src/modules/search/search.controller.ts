import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResultsResponse } from './response/search-results.response';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiCookieAuth()
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @CurrentUser() user: { id: string },
    @Query() query: SearchQueryDto,
  ): Promise<SearchResultsResponse> {
    return this.searchService.search(user.id, query.q, query.page, query.limit);
  }
}
