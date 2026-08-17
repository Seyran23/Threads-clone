import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { DEFAULT_USER_POSTS_PAGE_SIZE, MAX_USER_POSTS_PAGE_SIZE } from '../users.constants';

export class GetUserPostsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_USER_POSTS_PAGE_SIZE)
  limit: number = DEFAULT_USER_POSTS_PAGE_SIZE;
}
