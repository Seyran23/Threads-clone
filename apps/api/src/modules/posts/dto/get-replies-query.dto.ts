import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { DEFAULT_REPLIES_PAGE_SIZE, MAX_REPLIES_PAGE_SIZE } from '../posts.constants';

export class GetRepliesQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_REPLIES_PAGE_SIZE)
  limit: number = DEFAULT_REPLIES_PAGE_SIZE;
}
