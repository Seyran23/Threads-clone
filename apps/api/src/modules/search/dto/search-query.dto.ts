import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

import { DEFAULT_SEARCH_PAGE_SIZE, MAX_SEARCH_PAGE_SIZE } from '../search.constants';

export class SearchQueryDto {
  @IsString()
  @MinLength(1)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_PAGE_SIZE)
  limit: number = DEFAULT_SEARCH_PAGE_SIZE;
}
