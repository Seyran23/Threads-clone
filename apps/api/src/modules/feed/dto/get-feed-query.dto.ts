import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { DEFAULT_FEED_PAGE_SIZE, MAX_FEED_PAGE_SIZE } from '../feed.constants';

export class GetFeedQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_FEED_PAGE_SIZE)
  limit: number = DEFAULT_FEED_PAGE_SIZE;
}
