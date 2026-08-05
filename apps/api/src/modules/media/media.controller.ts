import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AppThrottlerGuard } from '@/common/throttler/app-throttler.guard';
import { MEDIA_UPLOAD_THROTTLE } from '@/common/throttler/throttler.constants';

import { PresignUploadDto } from './dto/presign-upload.dto';
import { MediaService } from './media.service';
import { PresignedUploadResponse } from './response/presigned-upload.response';

@ApiTags('media')
@ApiCookieAuth()
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign-upload')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AppThrottlerGuard)
  @Throttle(MEDIA_UPLOAD_THROTTLE)
  presignUpload(
    @CurrentUser() user: { id: string },
    @Body() dto: PresignUploadDto,
  ): Promise<PresignedUploadResponse> {
    return this.mediaService.createPresignedUpload(user.id, dto);
  }
}
