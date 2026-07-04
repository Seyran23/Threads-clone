import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, JwtAuthGuard],
})
export class MediaModule {}
