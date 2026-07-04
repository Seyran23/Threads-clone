import { IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

import { ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE_BYTES } from '../constants/media.constants';

export class PresignUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: (typeof ALLOWED_CONTENT_TYPES)[number];

  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE_BYTES)
  fileSize!: number;
}
