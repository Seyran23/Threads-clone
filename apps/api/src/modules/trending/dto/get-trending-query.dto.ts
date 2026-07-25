import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { DEFAULT_TRENDING_LIMIT, MAX_TRENDING_LIMIT } from '../trending.constants';

export class GetTrendingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TRENDING_LIMIT)
  limit: number = DEFAULT_TRENDING_LIMIT;
}
