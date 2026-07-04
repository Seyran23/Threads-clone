import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { PresignUploadDto } from './dto/presign-upload.dto';
import { MediaService } from './media.service';
import { PresignedUploadResponse } from './response/presigned-upload.response';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign-upload')
  @HttpCode(HttpStatus.CREATED)
  presignUpload(
    @CurrentUser() user: { id: string },
    @Body() dto: PresignUploadDto,
  ): Promise<PresignedUploadResponse> {
    return this.mediaService.createPresignedUpload(user.id, dto);
  }
}
